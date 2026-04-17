(function () {
  const STORAGE_KEY = 'ir-submission-desk-state';
  const CASES_STORAGE_KEY = 'ir-submission-desk-cases';
  const SNAPSHOTS_STORAGE_KEY = 'ir-submission-desk-snapshots';
  const MAX_CASES = 24;
  const MAX_SNAPSHOTS = 60;

  const data = window.SUBMISSION_TOOL_DATA;
  const form = document.getElementById('tool-form');
  const themeOptions = document.getElementById('theme-options');
  const methodOptions = document.getElementById('method-options');
  const summaryCards = document.getElementById('summary-cards');
  const detectedSignals = document.getElementById('detected-signals');
  const decisionMemo = document.getElementById('decision-memo');
  const cnResults = document.getElementById('cn-results');
  const ssciResults = document.getElementById('ssci-results');
  const copyPlanButton = document.getElementById('copy-plan');
  const saveCaseButton = document.getElementById('save-case');
  const saveSnapshotButton = document.getElementById('save-snapshot');
  const caseLibrary = document.getElementById('case-library');
  const snapshotLibrary = document.getElementById('snapshot-library');
  const workspaceStatus = document.getElementById('workspace-status');

  let activeCaseId = null;
  let currentAnalysis = null;

  function renderOptionGroup(container, items, fieldName) {
    container.innerHTML = items
      .map(
        (item) => `
          <label class="chip-option">
            <input type="checkbox" name="${fieldName}" value="${item.id}" />
            <span>${item.label}</span>
          </label>
        `
      )
      .join('');
  }

  function normalizeText(text) {
    return (text || '').trim().toLowerCase();
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function countChineseChars(text) {
    const matches = (text || '').match(/[\u4e00-\u9fff]/g);
    return matches ? matches.length : 0;
  }

  function countEnglishWords(text) {
    const matches = (text || '').match(/[A-Za-z][A-Za-z'’-]*/g);
    return matches ? matches.length : 0;
  }

  function splitKeywords(raw) {
    return (raw || '')
      .split(/[，,;；\n]+/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  function unique(list) {
    return [...new Set(list)];
  }

  function getCheckedValues(fieldName) {
    return Array.from(document.querySelectorAll(`input[name="${fieldName}"]:checked`)).map((input) => input.value);
  }

  function setCheckedValues(fieldName, values) {
    const valueSet = new Set(values || []);
    document.querySelectorAll(`input[name="${fieldName}"]`).forEach((input) => {
      input.checked = valueSet.has(input.value);
    });
  }

  function loadJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function loadSavedState() {
    return loadJson(STORAGE_KEY, null);
  }

  function saveState(state) {
    saveJson(STORAGE_KEY, state);
  }

  function loadCases() {
    return loadJson(CASES_STORAGE_KEY, []);
  }

  function saveCases(cases) {
    saveJson(CASES_STORAGE_KEY, cases.slice(0, MAX_CASES));
  }

  function loadSnapshots() {
    return loadJson(SNAPSHOTS_STORAGE_KEY, []);
  }

  function saveSnapshots(snapshots) {
    saveJson(SNAPSHOTS_STORAGE_KEY, snapshots.slice(0, MAX_SNAPSHOTS));
  }

  function ensureBaseState(state) {
    return Object.assign({ caseName: '', caseNote: '' }, data.defaultState, state || {});
  }

  function hydrateForm(state) {
    const merged = ensureBaseState(state);
    Object.entries(merged).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field && field.type !== 'checkbox') {
        field.value = value;
      }
    });
    setCheckedValues('themes', merged.themes || []);
    setCheckedValues('methods', merged.methods || []);
  }

  function collectState() {
    const formData = new window.FormData(form);
    const state = {};
    formData.forEach((value, key) => {
      if (key !== 'themes' && key !== 'methods') {
        state[key] = value;
      }
    });
    state.themes = getCheckedValues('themes');
    state.methods = getCheckedValues('methods');
    return ensureBaseState(state);
  }

  function detectLanguage(text) {
    const zhCount = countChineseChars(text);
    const enCount = countEnglishWords(text);
    if (!text.trim()) {
      return 'unknown';
    }
    if (zhCount > enCount * 2) {
      return 'zh';
    }
    if (enCount > zhCount * 2) {
      return 'en';
    }
    return 'mixed';
  }

  function detectThemes(text) {
    const haystack = normalizeText(text);
    return data.themePatterns
      .map((theme) => {
        const hits = theme.patterns.filter((pattern) => haystack.includes(pattern.toLowerCase())).length;
        return { id: theme.id, hits };
      })
      .filter((theme) => theme.hits > 0)
      .sort((left, right) => right.hits - left.hits)
      .map((theme) => theme.id);
  }

  function labelFor(list, id) {
    const found = list.find((item) => item.id === id);
    return found ? found.label : id;
  }

  function buildProfile(state) {
    const textBlob = [state.title, state.abstract, state.keywords].filter(Boolean).join(' ');
    const autoThemes = detectThemes(textBlob).slice(0, 5);
    const combinedThemes = unique([...(state.themes || []), ...autoThemes]);
    const keywords = splitKeywords(state.keywords);
    const abstractLanguage = detectLanguage(state.abstract || '');
    const titleLanguage = detectLanguage(state.title || '');
    const templateRisk = detectTemplateRisk(state.abstract || '');
    const lengthValue = Number.parseInt(state.length, 10) || 0;

    return {
      state,
      keywords,
      autoThemes,
      themes: combinedThemes,
      methods: state.methods || [],
      abstractLanguage,
      titleLanguage,
      combinedLanguage: state.language,
      textLanguage: detectLanguage(textBlob),
      lengthValue,
      titleZhLength: countChineseChars(state.title || ''),
      titleEnLength: countEnglishWords(state.title || ''),
      abstractZhLength: countChineseChars(state.abstract || ''),
      abstractEnLength: countEnglishWords(state.abstract || ''),
      templateRisk
    };
  }

  function detectTemplateRisk(text) {
    const markers = [
      '本文旨在',
      '首先',
      '其次',
      '最后',
      '综上所述',
      '不难发现',
      'it is worth noting',
      'this paper aims to',
      'in conclusion',
      'delve into',
      'multifaceted'
    ];
    const lowered = normalizeText(text);
    const hitMarkers = markers.filter((marker) => lowered.includes(marker.toLowerCase()));
    if (hitMarkers.length >= 4) {
      return {
        level: 'high',
        label: '模板化表达偏多',
        note: `检测到 ${hitMarkers.length} 处高频模板化表达，建议人工压缩和改写。`
      };
    }
    if (hitMarkers.length >= 2) {
      return {
        level: 'medium',
        label: '存在模板化措辞',
        note: '摘要里出现了多处高频模板化话语，投稿前可再打磨语气。'
      };
    }
    return {
      level: 'low',
      label: '模板化风险低',
      note: '未检测到明显的模板化高频表述。'
    };
  }

  function regionMatchScore(journal, profile) {
    if (!profile.state.region) {
      return { score: 0, reason: '未指定区域重点。' };
    }
    if (journal.regions.includes(profile.state.region)) {
      return { score: 8, reason: `区域重点与 ${journal.name} 的常见议题相符。` };
    }
    if (profile.state.region === 'global' && journal.regions.includes('global')) {
      return { score: 8, reason: '全球性议题与期刊范围一致。' };
    }
    if (journal.regions.includes('global')) {
      return { score: 4, reason: '期刊覆盖面较广，区域不完全受限。' };
    }
    return { score: -6, reason: '区域重点与期刊常见议题不完全一致。' };
  }

  function styleMatchScore(journal, profile) {
    let score = 0;
    const reasons = [];
    if (journal.styles.includes(profile.state.articleType)) {
      score += 12;
      reasons.push('文章主类型与期刊常见写法匹配。');
    } else {
      score -= 5;
      reasons.push('文章主类型与期刊主流写法存在偏差。');
    }

    const matchedMethods = profile.methods.filter((method) => journal.methods.includes(method));
    if (matchedMethods.length > 0) {
      score += Math.min(10, matchedMethods.length * 4);
      reasons.push(`方法上匹配 ${matchedMethods.length} 项。`);
    } else if (profile.methods.length > 0) {
      score -= 3;
      reasons.push('所选方法与期刊常见方法的交集较弱。');
    }
    return { score, reasons };
  }

  function themeMatchScore(journal, profile) {
    const overlap = profile.themes.filter((theme) => journal.scopeTags.includes(theme));
    const score = Math.min(30, overlap.length * 7);
    return {
      score,
      overlap,
      reason:
        overlap.length > 0
          ? `主题重合：${overlap.map((item) => labelFor(data.themeCatalog, item)).join('、')}`
          : '主题与期刊范围重合有限。'
    };
  }

  function lengthFit(journal, profile) {
    const currentLength = profile.lengthValue;
    if (!currentLength) {
      return {
        score: -4,
        warning: '未填写篇幅，无法核验字数 / 词数要求。',
        ready: false
      };
    }
    const range = journal.length;
    const diffLow = currentLength - range.min;
    const diffHigh = range.max - currentLength;
    if (currentLength >= range.min && currentLength <= range.max) {
      return {
        score: 12,
        warning: `${journal.track === 'cn' ? '字数' : '词数'}基本落在常见区间。`,
        ready: true
      };
    }
    const distance = currentLength < range.min ? Math.abs(diffLow) : Math.abs(diffHigh);
    const penalty = distance > range.max * 0.25 ? -12 : -6;
    const unitLabel = range.unit === 'chars' ? '字' : '词';
    const direction = currentLength < range.min ? '偏短' : '偏长';
    return {
      score: penalty,
      warning: `当前篇幅相对 ${journal.name} 常见区间 ${direction}，建议调整到 ${range.min}-${range.max}${unitLabel}。`,
      ready: false
    };
  }

  function languageFit(journal, profile) {
    if (journal.track === 'cn') {
      if (profile.state.language === 'zh' || profile.state.language === 'bilingual') {
        return { score: 8, issue: '中文稿形态基本可用。', ready: true };
      }
      return { score: -15, issue: '当前是英文稿，若投中文刊需要回译并重做中文摘要与引注。', ready: false };
    }
    if (profile.state.language === 'en') {
      return { score: 10, issue: '英文稿形态满足 SSCI 基本前提。', ready: true };
    }
    if (profile.state.language === 'bilingual') {
      return { score: -2, issue: '已有双语基础，但 SSCI 投稿仍需完整英文定稿。', ready: false };
    }
    return { score: -18, issue: '当前是中文稿，投 SSCI 需完成英文重写，而不是简单翻译。', ready: false };
  }

  function realismScore(journal, profile) {
    let score = 0;
    const notes = [];
    const stageWeight = profile.state.stage === 'phd' ? 1 : profile.state.stage === 'master' ? 0.7 : 1.2;
    score += (journal.doctoralSoloFriendliness - 3) * 4 * stageWeight;
    if (journal.coauthorNorm === 'often' && profile.state.advisorSupport === 'no') {
      score -= 8;
      notes.push('该刊经验上更常见合作署名，你当前偏向独作。');
    }
    if (journal.coauthorNorm === 'often' && profile.state.advisorSupport === 'yes') {
      score += 4;
      notes.push('你可与导师合作，这能缓解该刊的隐性门槛。');
    }
    if (journal.track === 'ssci') {
      if (profile.state.ssciExperience === 'none') {
        score -= journal.difficulty >= 4.5 ? 14 : journal.difficulty >= 4 ? 8 : 3;
        notes.push('暂无 SSCI 发表经验，英文刊现实性会受影响。');
      } else if (profile.state.ssciExperience === 'strong') {
        score += 6;
      }
    }
    if (journal.track === 'cn') {
      if (profile.state.cnExperience === 'none' && journal.difficulty >= 4.5) {
        score -= 8;
        notes.push('尚无中文核心发表，直接冲高位中文刊风险偏大。');
      } else if (profile.state.cnExperience === 'strong') {
        score += 5;
      }
    }
    if (profile.state.funding === 'none' && journal.fundingPreference >= 4) {
      score -= 5;
      notes.push('该刊更吃项目与成熟选题包装，而你当前缺少基金支撑。');
    }
    if (profile.state.strategy === 'practical') {
      score -= journal.difficulty >= 4.5 ? 8 : journal.difficulty >= 4 ? 4 : 0;
    }
    if (profile.state.strategy === 'reach') {
      score += journal.difficulty >= 4.5 ? 5 : 0;
    }
    return { score, notes };
  }

  function formatScore(journal, profile) {
    let score = 30;
    const gaps = [];
    const titleTooLongCn = journal.track === 'cn' && profile.titleZhLength > 24;
    const titleTooLongEn = journal.track === 'ssci' && profile.titleEnLength > 18;
    const keywordsCount = profile.keywords.length;
    const [minKeywords, maxKeywords] = journal.keywordsRange;

    if (titleTooLongCn || titleTooLongEn) {
      score -= 6;
      gaps.push('题目偏长，建议压缩并突出研究问题。');
    }
    if (keywordsCount < minKeywords || keywordsCount > maxKeywords) {
      score -= 8;
      gaps.push(`关键词数量与 ${journal.name} 常见要求不符。`);
    }
    if (!profile.state.abstract.trim()) {
      score -= 12;
      gaps.push('缺摘要，无法判断是否符合该刊摘要规范。');
    }
    if (journal.track === 'cn' && profile.abstractZhLength < 180) {
      score -= 6;
      gaps.push('中文摘要偏短，很多中文刊需要更完整的问题-方法-结论结构。');
    }
    if (journal.track === 'ssci' && profile.abstractEnLength < 120) {
      score -= 8;
      gaps.push('英文摘要偏短，通常需要更完整地交代研究问题与贡献。');
    }
    if (journal.track === 'cn' && profile.state.language === 'en') {
      score -= 8;
      gaps.push('若投中文刊，需要补全中文标题、摘要、关键词与脚注体系。');
    }
    if (journal.track === 'ssci' && profile.state.language !== 'en') {
      score -= 10;
      gaps.push('若投 SSCI，需要先完成英文定稿与国际文献对话。');
    }

    return { score: Math.max(0, score), gaps };
  }

  function labelDecision(totalScore, journal, profile) {
    if (journal.track === 'ssci' && journal.difficulty >= 4.5 && profile.state.ssciExperience === 'none') {
      return '冲刺';
    }
    if (journal.track === 'cn' && journal.difficulty >= 4.5 && profile.state.cnExperience === 'none' && profile.state.strategy !== 'reach') {
      return '冲刺';
    }
    if (totalScore >= 82) {
      return '首投';
    }
    if (totalScore >= 72) {
      return '稳妥备投';
    }
    if (totalScore >= 62) {
      return '可尝试';
    }
    return '先改后投';
  }

  function scoreJournal(journal, profile) {
    const theme = themeMatchScore(journal, profile);
    const style = styleMatchScore(journal, profile);
    const region = regionMatchScore(journal, profile);
    const length = lengthFit(journal, profile);
    const language = languageFit(journal, profile);
    const realism = realismScore(journal, profile);
    const format = formatScore(journal, profile);
    const total = Math.max(
      20,
      Math.min(
        100,
        28 + theme.score + style.score + region.score + length.score + language.score + realism.score + format.score * 0.25
      )
    );

    return {
      journal,
      total: Math.round(total),
      fitScore: Math.round(45 + theme.score + style.score + region.score),
      practicalityScore: Math.round(45 + language.score + realism.score + length.score),
      readinessScore: Math.round(format.score),
      theme,
      style,
      region,
      length,
      language,
      realism,
      format,
      decision: labelDecision(total, journal, profile)
    };
  }

  function compareResults(left, right) {
    return right.total - left.total || right.practicalityScore - left.practicalityScore;
  }

  function gatherWarnings(results) {
    const issues = [];
    results.forEach((result) => {
      result.format.gaps.forEach((gap) => issues.push(gap));
      if (result.length.ready === false) {
        issues.push(result.length.warning);
      }
    });
    return unique(issues).slice(0, 4);
  }

  function topResultByDecision(results, preferredDecision) {
    const found = results.find((result) => result.decision === preferredDecision);
    return found || results[0] || null;
  }

  function getCaseDisplayName(state) {
    return (state.caseName || '').trim() || (state.title || '').trim() || '未命名稿件';
  }

  function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function summarizeStateMeta(state) {
    const bits = [];
    if (state.language === 'zh') {
      bits.push('中文稿');
    } else if (state.language === 'en') {
      bits.push('英文稿');
    } else if (state.language === 'bilingual') {
      bits.push('双语草稿');
    }
    if (state.length) {
      bits.push(`${state.length}${state.language === 'zh' ? '字' : '词'}`);
    }
    if (state.region) {
      const regionLabels = {
        global: '全球',
        'china-us': '中美关系',
        'asia-pacific': '亚太',
        europe: '欧洲',
        'global-south': '全球南方',
        'middle-east': '中东',
        'other-region': '其他区域'
      };
      bits.push(regionLabels[state.region] || state.region);
    }
    return bits.join(' · ');
  }

  function buildAnalysisSummary(profile, cnRanked, ssciRanked) {
    const cnPrimary = topResultByDecision(cnRanked, '首投') || cnRanked[0] || null;
    const cnBackup = cnRanked[1] || null;
    const ssciPrimary = topResultByDecision(ssciRanked, '首投') || ssciRanked[0] || null;
    const ssciStretch = ssciRanked.find((result) => result.decision === '冲刺') || ssciRanked[1] || null;
    const problems = gatherWarnings([...cnRanked.slice(0, 2), ...ssciRanked.slice(0, 2)]);
    const biggestGap = problems[0] || '暂无明显格式硬伤。';

    const memoLines = [];
    if (cnPrimary) {
      memoLines.push(`中文首投建议：先投《${cnPrimary.journal.name}》；它对你的题材和当前作者处境更现实。`);
    }
    if (cnBackup) {
      memoLines.push(`中文备投建议：若首投不中，可转《${cnBackup.journal.name}》，格式切换成本更低。`);
    }
    if (ssciPrimary) {
      memoLines.push(`SSCI 首投建议：优先考虑 ${ssciPrimary.journal.name}，不要把第一次英文投稿直接押在最高门槛期刊。`);
    }
    if (ssciStretch) {
      memoLines.push(`英文冲刺项：${ssciStretch.journal.name} 可保留，但不建议作为唯一目标。`);
    }
    if (problems.length > 0) {
      memoLines.push(`你现在最该先处理的是：${problems.join('；')}`);
    }

    return {
      cnPrimary,
      cnBackup,
      ssciPrimary,
      ssciStretch,
      biggestGap,
      memoLines
    };
  }

  function renderSummaryCards(profile, summary) {
    const cards = [
      {
        label: '中文首选',
        title: summary.cnPrimary ? summary.cnPrimary.journal.name : '暂无',
        value: summary.cnPrimary ? `${summary.cnPrimary.total} 分` : '-',
        note: summary.cnPrimary ? summary.cnPrimary.decision : '请先录入稿件'
      },
      {
        label: 'SSCI 首选',
        title: summary.ssciPrimary ? summary.ssciPrimary.journal.name : '暂无',
        value: summary.ssciPrimary ? `${summary.ssciPrimary.total} 分` : '-',
        note: summary.ssciPrimary ? summary.ssciPrimary.decision : '请先录入稿件'
      },
      {
        label: '当前最大短板',
        title: summary.biggestGap,
        value: profile.templateRisk.label,
        note: profile.templateRisk.note
      }
    ];

    summaryCards.innerHTML = cards
      .map(
        (card) => `
          <article class="summary-card">
            <p class="summary-label">${escapeHtml(card.label)}</p>
            <h3>${escapeHtml(card.title)}</h3>
            <p class="summary-value">${escapeHtml(card.value)}</p>
            <p class="summary-note">${escapeHtml(card.note)}</p>
          </article>
        `
      )
      .join('');
  }

  function buildSignalCards(profile) {
    const signals = [
      {
        title: '自动识别主题',
        body: profile.autoThemes.length
          ? profile.autoThemes.map((theme) => labelFor(data.themeCatalog, theme)).join('、')
          : '摘要中暂未识别出明显主题，请多依靠手动选择。'
      },
      {
        title: '最终主题画像',
        body: profile.themes.length
          ? profile.themes.map((theme) => labelFor(data.themeCatalog, theme)).join('、')
          : '暂未设置主题。'
      },
      {
        title: '摘要语言',
        body:
          profile.abstractLanguage === 'zh'
            ? '以中文为主'
            : profile.abstractLanguage === 'en'
              ? '以英文为主'
              : profile.abstractLanguage === 'mixed'
                ? '中英混合'
                : '暂无摘要'
      },
      {
        title: '模板化风险',
        body: `${profile.templateRisk.label}：${profile.templateRisk.note}`
      },
      {
        title: '篇幅判断',
        body: profile.lengthValue
          ? `约 ${profile.lengthValue}${profile.state.language === 'zh' ? '字' : '词'}`
          : '未填写篇幅'
      },
      {
        title: '关键词数量',
        body: profile.keywords.length ? `${profile.keywords.length} 个关键词` : '未填写关键词'
      }
    ];

    detectedSignals.innerHTML = signals
      .map(
        (signal) => `
          <article class="signal-card">
            <h3>${escapeHtml(signal.title)}</h3>
            <p>${escapeHtml(signal.body)}</p>
          </article>
        `
      )
      .join('');
  }

  function renderMemo(summary) {
    decisionMemo.classList.remove('empty-state');
    decisionMemo.innerHTML = `<p>${summary.memoLines.map((line) => escapeHtml(line)).join('</p><p>')}</p>`;
    copyPlanButton.dataset.memo = summary.memoLines.join('\n');
  }

  function scoreClass(score) {
    if (score >= 80) {
      return 'score-high';
    }
    if (score >= 70) {
      return 'score-mid';
    }
    return 'score-low';
  }

  function renderJournalList(container, results, emptyText) {
    if (!results.length) {
      container.className = 'journal-list empty-state';
      container.textContent = emptyText;
      return;
    }
    container.className = 'journal-list';
    container.innerHTML = results
      .map((result) => {
        const journal = result.journal;
        const overlapText = result.theme.overlap.length
          ? result.theme.overlap.map((item) => labelFor(data.themeCatalog, item)).join('、')
          : '重合有限';
        const topNotes = unique([
          result.theme.reason,
          result.style.reasons[0],
          result.length.warning,
          ...(result.realism.notes || [])
        ]).slice(0, 3);
        const formatGaps = result.format.gaps.length
          ? result.format.gaps.slice(0, 3)
          : ['当前格式未见明显硬伤，但仍要核对最新投稿须知。'];
        const sourceLinks = journal.sources
          .map((source) => `<li><a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a></li>`)
          .join('');

        return `
          <article class="journal-card">
            <div class="journal-topline">
              <div>
                <p class="journal-track">${journal.track === 'cn' ? '中文核心 / C刊' : 'SSCI / 英文刊'}</p>
                <h4>${escapeHtml(journal.name)}</h4>
                <p class="journal-meta">${escapeHtml(journal.indexing)} · ${escapeHtml(journal.fitNote)}</p>
              </div>
              <div class="decision-pill ${result.decision === '首投' ? 'pill-primary' : result.decision === '冲刺' ? 'pill-warning' : 'pill-secondary'}">${escapeHtml(result.decision)}</div>
            </div>

            <div class="metric-row">
              <div class="metric-card ${scoreClass(result.total)}">
                <span>总分</span>
                <strong>${result.total}</strong>
              </div>
              <div class="metric-card">
                <span>题材贴合</span>
                <strong>${result.fitScore}</strong>
              </div>
              <div class="metric-card">
                <span>现实可行</span>
                <strong>${result.practicalityScore}</strong>
              </div>
              <div class="metric-card">
                <span>格式准备度</span>
                <strong>${result.readinessScore}</strong>
              </div>
            </div>

            <div class="journal-columns">
              <div>
                <p class="mini-title">为什么匹配</p>
                <ul class="bullet-list">
                  <li>主题交集：${escapeHtml(overlapText)}</li>
                  ${topNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
                </ul>
              </div>
              <div>
                <p class="mini-title">你要先改什么</p>
                <ul class="bullet-list">
                  ${formatGaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join('')}
                </ul>
              </div>
            </div>

            <details>
              <summary>展开查看格式与来源</summary>
              <div class="details-body">
                <p><strong>常见篇幅：</strong>${journal.length.min}-${journal.length.max}${journal.length.unit === 'chars' ? '字' : '词'} <span class="confidence-tag">${journal.length.confidence === 'high' ? '高置信' : journal.length.confidence === 'medium' ? '中置信' : '估计值'}</span></p>
                <p><strong>摘要要求：</strong>${escapeHtml(journal.abstract)}</p>
                <p><strong>题目提醒：</strong>${escapeHtml(journal.titleGuideline)}</p>
                <p><strong>审稿 / 格式提醒：</strong>${escapeHtml(journal.reviewStyle)}</p>
                <p><strong>作者经验提醒：</strong>${escapeHtml(journal.riskNote)}</p>
                <p><strong>来源：</strong></p>
                <ul class="bullet-list source-list">${sourceLinks}</ul>
              </div>
            </details>
          </article>
        `;
      })
      .join('');
  }

  function renderWorkspaceStatus() {
    const cases = loadCases();
    const activeCase = cases.find((item) => item.id === activeCaseId);
    if (activeCase) {
      workspaceStatus.textContent = `当前稿件已保存：${getCaseDisplayName(activeCase.state)}；最近更新 ${formatDateTime(activeCase.updatedAt)}。`;
      return;
    }
    const state = collectState();
    const label = getCaseDisplayName(state);
    if ((state.title || '').trim() || (state.caseName || '').trim()) {
      workspaceStatus.textContent = `当前稿件“${label}”尚未保存到稿件库。`;
      return;
    }
    workspaceStatus.textContent = '当前稿件尚未保存到稿件库。';
  }

  function renderCaseLibrary() {
    const cases = loadCases().sort((left, right) => right.updatedAt - left.updatedAt);
    if (!cases.length) {
      caseLibrary.className = 'utility-list empty-state';
      caseLibrary.textContent = '还没有保存任何稿件。';
      return;
    }

    caseLibrary.className = 'utility-list';
    caseLibrary.innerHTML = cases
      .map((item) => {
        const state = ensureBaseState(item.state);
        const activeClass = item.id === activeCaseId ? 'active-case' : '';
        return `
          <article class="utility-card ${activeClass}">
            <div class="utility-head">
              <div>
                <p class="summary-label">稿件版本</p>
                <h3>${escapeHtml(getCaseDisplayName(state))}</h3>
              </div>
              <span class="confidence-tag">${escapeHtml(formatDateTime(item.updatedAt))}</span>
            </div>
            <p class="utility-meta">${escapeHtml((state.title || '').trim() || '未填写标题')}</p>
            <p class="utility-submeta">${escapeHtml(summarizeStateMeta(state) || '尚未补齐稿件元信息')}</p>
            <p class="utility-note">${escapeHtml((state.caseNote || '').trim() || '没有备注')}</p>
            <div class="utility-actions">
              <button class="minor-button" type="button" data-case-action="load" data-id="${item.id}">载入</button>
              <button class="minor-button danger-button" type="button" data-case-action="delete" data-id="${item.id}">删除</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderSnapshotLibrary() {
    const snapshots = loadSnapshots().sort((left, right) => right.savedAt - left.savedAt);
    if (!snapshots.length) {
      snapshotLibrary.className = 'utility-list empty-state';
      snapshotLibrary.textContent = '还没有保存任何投稿判断。';
      return;
    }

    snapshotLibrary.className = 'utility-list';
    snapshotLibrary.innerHTML = snapshots
      .map((snapshot) => `
        <article class="utility-card snapshot-card">
          <div class="utility-head">
            <div>
              <p class="summary-label">投稿判断</p>
              <h3>${escapeHtml(snapshot.caseName || snapshot.title || '未命名判断')}</h3>
            </div>
            <span class="confidence-tag">${escapeHtml(formatDateTime(snapshot.savedAt))}</span>
          </div>
          <p class="utility-meta">${escapeHtml(snapshot.title || '未填写标题')}</p>
          <p class="utility-submeta">中文：${escapeHtml(snapshot.topCN?.name || '暂无')} · 英文：${escapeHtml(snapshot.topSSCI?.name || '暂无')}</p>
          <p class="utility-note">${escapeHtml(snapshot.memoLines?.[0] || snapshot.gap || '未生成摘要')}</p>
          <div class="utility-actions">
            <button class="minor-button" type="button" data-snapshot-action="load" data-id="${snapshot.id}">载入当时稿件</button>
            <button class="minor-button danger-button" type="button" data-snapshot-action="delete" data-id="${snapshot.id}">删除</button>
          </div>
        </article>
      `)
      .join('');
  }

  function renderLibraries() {
    renderCaseLibrary();
    renderSnapshotLibrary();
    renderWorkspaceStatus();
  }

  function runAnalysis(state) {
    const profile = buildProfile(state);
    const scored = data.journals.map((journal) => scoreJournal(journal, profile)).sort(compareResults);
    const cnRanked = scored.filter((item) => item.journal.track === 'cn');
    const ssciRanked = scored.filter((item) => item.journal.track === 'ssci');
    const summary = buildAnalysisSummary(profile, cnRanked, ssciRanked);

    renderSummaryCards(profile, summary);
    buildSignalCards(profile);
    renderMemo(summary);
    renderJournalList(cnResults, cnRanked, '暂无中文刊结果。');
    renderJournalList(ssciResults, ssciRanked, '暂无 SSCI 结果。');

    currentAnalysis = {
      profile,
      cnRanked,
      ssciRanked,
      summary,
      state
    };
  }

  function applyStateAndAnalyze(state, options) {
    const mergedOptions = Object.assign({ activeCaseId: null }, options || {});
    activeCaseId = mergedOptions.activeCaseId;
    hydrateForm(state);
    const current = collectState();
    saveState(current);
    runAnalysis(current);
    renderLibraries();
  }

  function flashButton(button, successText) {
    const original = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = original;
    button.textContent = successText;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  }

  function saveCurrentCase() {
    const state = collectState();
    const now = Date.now();
    const cases = loadCases();
    const existingIndex = cases.findIndex((item) => item.id === activeCaseId);
    const caseRecord = {
      id: existingIndex >= 0 ? activeCaseId : `case-${now}`,
      createdAt: existingIndex >= 0 ? cases[existingIndex].createdAt : now,
      updatedAt: now,
      state
    };

    if (existingIndex >= 0) {
      cases.splice(existingIndex, 1);
    }
    cases.unshift(caseRecord);
    activeCaseId = caseRecord.id;
    saveCases(cases);
    saveState(state);
    renderLibraries();
    flashButton(saveCaseButton, '已保存');
  }

  function saveCurrentSnapshot() {
    const state = collectState();
    saveState(state);
    runAnalysis(state);
    const summary = currentAnalysis.summary;
    const now = Date.now();
    const snapshots = loadSnapshots();
    const snapshot = {
      id: `snapshot-${now}`,
      caseId: activeCaseId,
      caseName: getCaseDisplayName(state),
      title: state.title || '',
      savedAt: now,
      memoLines: summary.memoLines,
      gap: summary.biggestGap,
      topCN: summary.cnPrimary
        ? { name: summary.cnPrimary.journal.name, total: summary.cnPrimary.total, decision: summary.cnPrimary.decision }
        : null,
      topSSCI: summary.ssciPrimary
        ? { name: summary.ssciPrimary.journal.name, total: summary.ssciPrimary.total, decision: summary.ssciPrimary.decision }
        : null,
      state
    };

    snapshots.unshift(snapshot);
    saveSnapshots(snapshots);
    renderLibraries();
    flashButton(saveSnapshotButton, '已记录');
  }

  function deleteCase(caseId) {
    const nextCases = loadCases().filter((item) => item.id !== caseId);
    if (activeCaseId === caseId) {
      activeCaseId = null;
    }
    saveCases(nextCases);
    renderLibraries();
  }

  function deleteSnapshot(snapshotId) {
    const nextSnapshots = loadSnapshots().filter((item) => item.id !== snapshotId);
    saveSnapshots(nextSnapshots);
    renderLibraries();
  }

  function loadCase(caseId) {
    const caseRecord = loadCases().find((item) => item.id === caseId);
    if (!caseRecord) {
      return;
    }
    applyStateAndAnalyze(caseRecord.state, { activeCaseId: caseRecord.id });
  }

  function loadSnapshot(snapshotId) {
    const snapshot = loadSnapshots().find((item) => item.id === snapshotId);
    if (!snapshot) {
      return;
    }
    const cases = loadCases();
    const nextCaseId = cases.some((item) => item.id === snapshot.caseId) ? snapshot.caseId : null;
    applyStateAndAnalyze(snapshot.state, { activeCaseId: nextCaseId });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = collectState();
    saveState(state);
    runAnalysis(state);
    renderLibraries();
  });

  document.getElementById('load-demo').addEventListener('click', () => {
    applyStateAndAnalyze(data.demoState, { activeCaseId: null });
  });

  document.getElementById('reset-form').addEventListener('click', () => {
    applyStateAndAnalyze(data.defaultState, { activeCaseId: null });
  });

  saveCaseButton.addEventListener('click', () => {
    saveCurrentCase();
  });

  saveSnapshotButton.addEventListener('click', () => {
    saveCurrentSnapshot();
  });

  copyPlanButton.addEventListener('click', async () => {
    const memo = copyPlanButton.dataset.memo || '';
    if (!memo) {
      return;
    }
    try {
      await navigator.clipboard.writeText(memo);
      flashButton(copyPlanButton, '已复制');
    } catch (error) {
      flashButton(copyPlanButton, '复制失败');
    }
  });

  caseLibrary.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-case-action]');
    if (!target) {
      return;
    }
    const caseId = target.dataset.id;
    if (target.dataset.caseAction === 'load') {
      loadCase(caseId);
    }
    if (target.dataset.caseAction === 'delete') {
      deleteCase(caseId);
    }
  });

  snapshotLibrary.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-snapshot-action]');
    if (!target) {
      return;
    }
    const snapshotId = target.dataset.id;
    if (target.dataset.snapshotAction === 'load') {
      loadSnapshot(snapshotId);
    }
    if (target.dataset.snapshotAction === 'delete') {
      deleteSnapshot(snapshotId);
    }
  });

  renderOptionGroup(themeOptions, data.themeCatalog, 'themes');
  renderOptionGroup(methodOptions, data.methodCatalog, 'methods');
  const initialState = loadSavedState() || data.defaultState;
  applyStateAndAnalyze(initialState, { activeCaseId: null });
})();
