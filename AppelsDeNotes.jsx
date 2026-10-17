/*
 * AppelsDeNotes.jsx — v1.0.0
 * Appels de notes et renvois (¹ ² ³, (1), *, †) pour Adobe Illustrator : contrôle et renumérotation.
 * Footnote / disclaimer reference markers for Adobe Illustrator: checking and renumbering.
 *
 * FR : Illustrator n'a pas de notes de bas de page. Sur une affiche, un flyer, un emballage ou un
 *      catalogue, les renvois (« 999 DA¹ », « Livraison offerte* », « Prix TTC(2) ») et leurs mentions
 *      (« ¹ Offre valable jusqu'au… ») sont tapés à la main : un appel sans mention, une mention sans
 *      appel, deux mentions pour le même numéro ou une numérotation qui ne suit plus l'ordre de lecture
 *      passent facilement au BAT. Ce script relie chaque appel à sa mention, plan de travail par
 *      plan de travail, liste les erreurs, peut renuméroter dans l'ordre de lecture (gauche → droite
 *      ou droite → gauche pour l'arabe), remettre les mentions dans l'ordre, enlever l'espace avant
 *      l'appel, placer l'appel avant ou après la ponctuation, et créer les mentions manquantes.
 * EN : Illustrator has no footnotes. On posters, flyers, packaging and catalogues, reference marks
 *      and their disclaimers are typed by hand. This script links every mark to its note, artboard by
 *      artboard, lists the problems and can renumber in reading order (LTR, or RTL for Arabic),
 *      re-sort the notes, remove the space before a mark, fix mark/punctuation order and create
 *      placeholders for missing notes.
 *
 * Auteur / Author : Amirouche Amwanes — Licence MIT (2026).
 * Cible / Target : Illustrator CC 2018 – 2026 (ExtendScript ES3). NON TESTÉ DANS ILLUSTRATOR / NOT TESTED IN ILLUSTRATOR.
 * Conseil : travaillez sur une copie du fichier. Tip: work on a copy. Ctrl/Cmd+Z annule les corrections.
 * Aucun appel réseau, aucune collecte de données. No network access, no data collection.
 */

//@target illustrator

var ADN = (function () {
    var VERSION = '1.0.0';
    var MM = 2.834645669;

    var FR = true;
    try { FR = String(app.locale).substr(0, 2).toLowerCase() === 'fr'; } catch (eLoc) { FR = true; }
    function T(fr, en) { return FR ? fr : en; }
    function setLang(isFr) { FR = !!isFr; }

    /* ================================================================== */
    /* MOTEUR PUR (sans DOM, testé sous Node) / PURE ENGINE (no DOM)       */
    /* ================================================================== */

    // Chiffres en exposant Unicode / Unicode superscript digits ⁰¹²³⁴⁵⁶⁷⁸⁹
    var SUPD = '\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079';
    // Symboles de renvoi / reference symbols : * ∗ † ‡ § ‖ ¶
    var SYMCH = '*\u2217\u2020\u2021\u00A7\u2016\u00B6';
    // Ordre classique / classic order : * † ‡ § ‖ ¶ puis doublés / then doubled
    var SEQ_DAGGER = ['*', '\u2020', '\u2021', '\u00A7', '\u2016', '\u00B6', '**', '\u2020\u2020', '\u2021\u2021', '\u00A7\u00A7'];
    // Astérisques répétés / repeated asterisks : * ** *** ****
    var SEQ_STAR = ['*', '**', '***', '****', '*****'];
    var PUNCT = '.,;:!?';
    var DEFAULT_UNITS = 'm cm mm km dm \u00B5m um ft in yd mi mc m\u00B2 \u0645 \u0633\u0645 \u0645\u0645 \u0643\u0645';
    var ABBREV = ['etc', 'cf', 'ex', 'env', 'min', 'max', 'art', 'av', 'bd', 'tel', 't\u00E9l', 'no', 'n\u00B0', 'p', 'pp', 'vol', 'ed', '\u00E9d', 'mme', 'mlle', 'dr', 'st', 'ste', 'vs', 'approx', 'incl', 'excl', 'hors', 'sept', 'oct', 'nov', 'd\u00E9c', 'janv', 'f\u00E9vr', 'avr', 'juil', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'dec', 'inc', 'ltd', 'co', 'jr', 'sr', 'mr', 'mrs', 'ms', 'eurl', 'sarl', 'spa'];

    function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
    function supVal(c) { return SUPD.indexOf(c); }
    function digitVal(c) {
        var k;
        if (!c) { return -1; }
        k = c.charCodeAt(0);
        if (k >= 48 && k <= 57) { return k - 48; }
        if (k >= 0x0660 && k <= 0x0669) { return k - 0x0660; }
        if (k >= 0x06F0 && k <= 0x06F9) { return k - 0x06F0; }
        return -1;
    }
    function digitScript(c) {
        var k = c.charCodeAt(0);
        if (supVal(c) >= 0) { return 'sup'; }
        if (k >= 0x0660 && k <= 0x0669) { return 'ara'; }
        if (k >= 0x06F0 && k <= 0x06F9) { return 'per'; }
        return 'lat';
    }
    function fmtNum(n, script) {
        var s = String(n), out = '', i, d;
        for (i = 0; i < s.length; i++) {
            d = s.charCodeAt(i) - 48;
            if (script === 'sup') { out += SUPD.charAt(d); }
            else if (script === 'ara') { out += String.fromCharCode(0x0660 + d); }
            else if (script === 'per') { out += String.fromCharCode(0x06F0 + d); }
            else { out += String(d); }
        }
        return out;
    }
    function isArabicLetter(c) {
        var k;
        if (!c) { return false; }
        k = c.charCodeAt(0);
        return (k >= 0x0620 && k <= 0x064A) || (k >= 0x066E && k <= 0x06D3) || k === 0x06D5 || (k >= 0x06FA && k <= 0x06FC) ||
            (k >= 0x0750 && k <= 0x077F) || (k >= 0x08A0 && k <= 0x08C9) || (k >= 0xFB50 && k <= 0xFDFF) || (k >= 0xFE70 && k <= 0xFEFC);
    }
    function isLatinLetter(c) {
        var k;
        if (!c) { return false; }
        k = c.charCodeAt(0);
        return (k >= 65 && k <= 90) || (k >= 97 && k <= 122) || (k >= 0xC0 && k <= 0x24F && k !== 0xD7 && k !== 0xF7) ||
            (k >= 0x0370 && k <= 0x03FF) || (k >= 0x0400 && k <= 0x04FF) || (k >= 0x1E00 && k <= 0x1EFF) || (k >= 0x2D30 && k <= 0x2D7F);
    }
    function isLetter(c) { return isLatinLetter(c) || isArabicLetter(c); }
    function isSpace(c) {
        if (!c) { return false; }
        return c === ' ' || c === '\t' || c === '\u00A0' || c === '\u202F' || c === '\u3000' || (c >= '\u2000' && c <= '\u200A');
    }
    function isBreak(c) { return c === '\r' || c === '\n' || c === '\u0003' || c === '\u2028' || c === '\u2029'; }
    function isSym(c) { return !!c && SYMCH.indexOf(c) >= 0; }
    function normSym(s) { return String(s).replace(/\u2217/g, '*'); }
    function isOpenQuote(c) { return c === '\u00AB' || c === '"' || c === '\u201C' || c === '\u2018' || c === '\'' || c === '('; }

    // Mot qui précède la position i (lettres uniquement) / word right before index i (letters only)
    function wordBefore(text, i) {
        var j = i;
        while (j > 0 && isLetter(text.charAt(j - 1))) { j--; }
        return text.substring(j, i);
    }
    function parseUnits(s) {
        var a = trimStr(s || '').split(/[\s,;]+/), o = {}, i;
        for (i = 0; i < a.length; i++) { if (a[i]) { o[a[i].toLowerCase()] = true; } }
        return o;
    }
    function symRankIn(seq, s) { var i; for (i = 0; i < seq.length; i++) { if (seq[i] === s) { return i; } } return -1; }

    /* ---------------- Analyse d'un texte / parsing one text ---------------- */
    // text : contenu du bloc / frame contents ; supAt(i) : vrai si le caractère i est mis en exposant
    // (position Exposant, OpenType exposant ou décalage vers le haut) / true when char i is formatted superscript.
    // Rend la liste des marques : appels (call) et mentions (note).
    function parseText(text, supAt, opts) {
        var toks = [], i = 0, n = text.length, c, j, k, ps = 0, para = 0, tk, units, fam;
        opts = opts || {};
        fam = opts.fam || { num: true, par: true, sym: true };
        units = opts.unitsMap || parseUnits(opts.units === undefined ? DEFAULT_UNITS : opts.units);
        supAt = supAt || function () { return false; };
        var paraArabic = [], paraStarts = [0];
        // Écriture de chaque paragraphe / script of each paragraph
        (function () {
            var p = 0, ar = 0, la = 0, q, ch;
            for (q = 0; q <= n; q++) {
                ch = q < n ? text.charAt(q) : '\r';
                if (q === n || isBreak(ch)) { paraArabic[p] = ar > la; p++; ar = 0; la = 0; if (q < n) { paraStarts[p] = q + 1; } }
                else if (isArabicLetter(ch)) { ar++; } else if (isLatinLetter(ch)) { la++; }
            }
        })();

        function atParaStart(s) { var q; for (q = ps; q < s; q++) { if (!isSpace(text.charAt(q))) { return false; } } return true; }
        function paraEndFrom(s) { var q = s; while (q < n && !isBreak(text.charAt(q))) { q++; } return q; }

        function classify(t) {
            var p = t.s > ps ? text.charAt(t.s - 1) : '', nx = text.charAt(t.e), q = t.e, after, w;
            if (isSpace(text.charAt(q))) { q++; }
            after = text.charAt(q);
            t.para = para; t.paraStart = ps; t.paraEnd = paraEndFrom(t.s); t.arabic = !!paraArabic[para];
            if (atParaStart(t.s)) {
                if (t.weakCandidate) {
                    if (isLetter(after) || isOpenQuote(after) || digitVal(after) >= 0) { t.role = 'note'; t.weak = true; t.lead = true; return t; }
                    return null;
                }
                if (q >= n || isBreak(after)) { return null; }
                t.role = 'note'; t.lead = true; return t;
            }
            if (t.weakCandidate) { return null; }
            var prevSpace = isSpace(p), pq = t.s - 1, pn;
            while (pq > ps && isSpace(text.charAt(pq))) { pq--; }
            pn = pq >= ps ? text.charAt(pq) : '';
            // Mention en ligne seulement après une fin de phrase / inline note only after a sentence end
            if (prevSpace && (isLetter(after) || isOpenQuote(after)) && after !== '(' && (pn === '' || '.!?;:\u00BB)\u2013\u2014|/\u2022\u00B7'.indexOf(pn) >= 0)) {
                t.role = 'note'; t.lead = false; return t;   // mention en ligne / inline note
            }
            if (!prevSpace) {
                if (t.fam === 'num') {
                    // Exposants mathématiques et unités / math exponents and units
                    w = wordBefore(text, t.s);
                    if ((t.val === 2 || t.val === 3) && w && units[w.toLowerCase()]) { return null; }
                    if (w && w.length === 1 && isLatinLetter(w) && (t.val === 2 || t.val === 3)) { return null; }
                    if (p === '\u207B' || p === '\u207A') { return null; }
                    if (digitVal(p) >= 0) {
                        if (/(^|[^0-9A-Za-z])10$/.test(text.substring(Math.max(0, t.s - 4), t.s))) { return null; }
                    }
                    if (p === '-' && t.sup && supAt(t.s - 1)) { return null; }
                }
                if (t.fam === 'sym') {
                    if (digitVal(p) >= 0 && digitVal(nx) >= 0) { return null; }   // 2*3
                    if (isLetter(p) && isLetter(nx)) { return null; }             // m*t (censure / censored)
                }
                t.role = 'call'; t.loose = false; return t;
            }
            if (t.fam === 'par' && digitVal(nx) >= 0) { return null; }
            t.role = 'call'; t.loose = true; return t;
        }

        while (i < n) {
            c = text.charAt(i);
            if (isBreak(c)) { i++; ps = i; para++; continue; }
            tk = null;
            if (fam.num && supVal(c) >= 0) {
                j = i; while (j < n && supVal(text.charAt(j)) >= 0) { j++; }
                if (j - i <= 3) { tk = { fam: 'num', s: i, e: j, ds: i, dl: j - i, script: 'sup', sup: false, val: Number(dval(text.substring(i, j))) }; }
                else { i = j; continue; }
            } else if (fam.par && c === '(' && digitVal(text.charAt(i + 1)) >= 0) {
                j = i + 1; while (j < n && digitVal(text.charAt(j)) >= 0) { j++; }
                if (text.charAt(j) === ')' && j - i - 1 <= 2) {
                    tk = { fam: 'par', s: i, e: j + 1, ds: i + 1, dl: j - i - 1, script: digitScript(text.charAt(i + 1)), sup: !!supAt(i + 1), val: Number(dval(text.substring(i + 1, j))) };
                }
            } else if (fam.num && digitVal(c) >= 0) {
                j = i; while (j < n && digitVal(text.charAt(j)) >= 0) { j++; }
                if (supAt(i)) {
                    k = i; while (k < j && supAt(k)) { k++; }
                    if (k - i <= 3 && (k === j)) { tk = { fam: 'num', s: i, e: k, ds: i, dl: k - i, script: digitScript(c), sup: true, val: Number(dval(text.substring(i, k))) }; }
                } else if (j - i <= 2 && atParaStart(i) && (text.charAt(j) === '.' || text.charAt(j) === ')' || isSpace(text.charAt(j)))) {
                    // « 1. » ou « 1) » en début de paragraphe : mention faible (compte seulement si un appel 1 existe)
                    // "1." at paragraph start: weak note (only counts when a matching mark exists)
                    tk = { fam: 'num', s: i, e: (text.charAt(j) === '.' || text.charAt(j) === ')') ? j + 1 : j, ds: i, dl: j - i, script: digitScript(c), sup: false, val: Number(dval(text.substring(i, j))), weakCandidate: true };
                }
                if (!tk) { i = j; continue; }
            } else if (fam.sym && isSym(c)) {
                j = i + 1;
                while (j < n && j - i < 5 && normSym(text.charAt(j)) === normSym(c)) { j++; }
                if ((c === '\u00A7' || c === '\u00B6') && j - i === 1 && digitVal(text.charAt(j)) >= 0) { i = j; continue; }   // § 12 (article)
                if ((c === '\u00A7' || c === '\u00B6') && isSpace(text.charAt(j)) && digitVal(text.charAt(j + 1)) >= 0) { i = j; continue; }
                tk = { fam: 'sym', s: i, e: j, ds: i, dl: j - i, script: 'sym', sup: !!supAt(i), sym: normSym(text.substring(i, j)) };
            }
            if (tk) {
                var raw = tk;
                tk = classify(tk);
                if (!tk) { i = raw.e; continue; }
                if (tk) {
                    tk.key = tk.fam + ':' + (tk.fam === 'sym' ? tk.sym : tk.val);
                    tk.text = text.substring(tk.s, tk.e);
                    toks.push(tk);
                    i = tk.e;
                    continue;
                }
            }
            i++;
        }
        // Espaces et ponctuation autour des appels / spaces and punctuation around marks
        for (k = 0; k < toks.length; k++) {
            tk = toks[k];
            if (tk.role !== 'call') { continue; }
            tk.spaceAt = (tk.loose && tk.s > 0 && isSpace(text.charAt(tk.s - 1)) && !isSpace(text.charAt(tk.s - 2))) ? tk.s - 1 : -1;
            var pb = tk.spaceAt >= 0 ? tk.s - 2 : tk.s - 1;
            tk.punctBefore = (pb >= 0 && PUNCT.indexOf(text.charAt(pb)) >= 0) ? pb : -1;
            tk.punctAfter = (tk.e < n && PUNCT.indexOf(text.charAt(tk.e)) >= 0) ? tk.e : -1;
            // « ¹,² » : la virgule entre deux appels n'est pas une ponctuation à déplacer / comma between two marks
            if (tk.punctAfter >= 0 && k + 1 < toks.length && toks[k + 1].s === tk.e + 1 && toks[k + 1].role === 'call') { tk.punctAfter = -1; }
            if (tk.punctBefore >= 0 && k > 0 && toks[k - 1].e === pb && toks[k - 1].role === 'call') { tk.punctBefore = -1; }
            if (tk.punctBefore >= 0 && text.charAt(pb) === '.') {
                var wb = wordBefore(text, pb).toLowerCase();
                if (!wb || wb.length === 1 || inArr(ABBREV, wb) || /\.[A-Za-z]$/.test(text.substring(Math.max(0, pb - 2), pb)) || digitVal(text.charAt(pb - 1)) >= 0) { tk.abbrevDot = true; }
            }
        }
        return toks;
    }
    function dval(s) { var o = '', i, v; for (i = 0; i < s.length; i++) { v = supVal(s.charAt(i)); if (v < 0) { v = digitVal(s.charAt(i)); } o += String(v); } return o; }
    function inArr(a, v) { var i; for (i = 0; i < a.length; i++) { if (a[i] === v) { return true; } } return false; }

    /* ---------------- Ordre de lecture / reading order ---------------- */
    // frames : [{ box:[l,t,r,b] }] ; rtl : lecture de droite à gauche / right-to-left reading
    function readingOrder(frames, rtl) {
        var idx = [], i, rows = [], cur = null, r, out = [];
        for (i = 0; i < frames.length; i++) { idx.push(i); }
        idx.sort(function (a, b) { return frames[b].box[1] - frames[a].box[1] || frames[a].box[0] - frames[b].box[0]; });
        for (i = 0; i < idx.length; i++) {
            var f = frames[idx[i]], h = Math.max(1, f.box[1] - f.box[3]);
            if (!cur || f.box[1] < cur.top - cur.tol) { cur = { top: f.box[1], tol: Math.max(1, Math.min(h, cur ? cur.h : h) * 0.5), h: h, items: [] }; rows.push(cur); }
            cur.items.push(idx[i]);
        }
        for (r = 0; r < rows.length; r++) {
            rows[r].items.sort(function (a, b) { return rtl ? frames[b].box[2] - frames[a].box[2] : frames[a].box[0] - frames[b].box[0]; });
            for (i = 0; i < rows[r].items.length; i++) { out.push(rows[r].items[i]); }
        }
        return out;
    }

    /* ---------------- Analyse d'un groupe (plan de travail) / analysing one group ---------------- */
    function countScripts(text) {
        var ar = 0, la = 0, i, c;
        for (i = 0; i < text.length; i++) { c = text.charAt(i); if (isArabicLetter(c)) { ar++; } else if (isLatinLetter(c)) { la++; } }
        return { ar: ar, la: la };
    }
    function excerpt(text, s, e) {
        var a = Math.max(0, s - 22), b = Math.min(text.length, e + 22), t = text.substring(a, b);
        t = t.replace(/[\r\n\u0003\u2028\u2029]+/g, ' / ').replace(/\t/g, ' ');
        return (a > 0 ? '\u2026' : '') + t + (b < text.length ? '\u2026' : '');
    }
    function markLabel(fam, key) {
        if (fam === 'num') { return fmtNum(key, 'sup'); }
        if (fam === 'par') { return '(' + key + ')'; }
        return key;
    }
    function tokKeyVal(t) { return t.fam === 'sym' ? t.sym : t.val; }

    // frames : [{ id, box, text, toks, ar, la }] ; opts : { rtl:'auto'|'ltr'|'rtl', punct:'off'|'fr'|'en' }
    function analyzeGroup(frames, opts) {
        var i, j, t, f, rtl, ar = 0, la = 0, order, rankOf = {}, calls = [], notes = [], noteMap = {}, callMap = {}, issues = [];
        opts = opts || {};
        for (i = 0; i < frames.length; i++) {
            if (frames[i].ar === undefined) { var cs = countScripts(frames[i].text); frames[i].ar = cs.ar; frames[i].la = cs.la; }
            ar += frames[i].ar; la += frames[i].la;
        }
        rtl = opts.rtl === 'rtl' ? true : (opts.rtl === 'ltr' ? false : ar > la);
        order = readingOrder(frames, rtl);
        for (i = 0; i < order.length; i++) { rankOf[order[i]] = i; }
        for (i = 0; i < frames.length; i++) {
            f = frames[i];
            for (j = 0; j < f.toks.length; j++) {
                t = f.toks[j];
                var it = { f: i, rank: rankOf[i], t: t };
                if (t.role === 'call') { calls.push(it); } else { notes.push(it); }
            }
        }
        calls.sort(function (a, b) { return a.rank - b.rank || a.t.s - b.t.s; });
        notes.sort(function (a, b) { return a.rank - b.rank || a.t.s - b.t.s; });
        // Mentions fortes / strong notes, then loose marks and weak notes
        var anyNote = {}, strictCall = {};
        for (i = 0; i < notes.length; i++) { anyNote[notes[i].t.key] = true; }
        var keptCalls = [];
        for (i = 0; i < calls.length; i++) {
            t = calls[i].t;
            if (t.loose && !anyNote[t.key]) { continue; }
            keptCalls.push(calls[i]); strictCall[t.key] = true;
        }
        var keptNotes = [];
        for (i = 0; i < notes.length; i++) {
            t = notes[i].t;
            if (t.weak && !strictCall[t.key]) { continue; }
            keptNotes.push(notes[i]);
        }
        calls = keptCalls; notes = keptNotes;
        for (i = 0; i < calls.length; i++) { (callMap[calls[i].t.key] = callMap[calls[i].t.key] || []).push(calls[i]); }
        for (i = 0; i < notes.length; i++) { (noteMap[notes[i].t.key] = noteMap[notes[i].t.key] || []).push(notes[i]); }

        function issue(sev, code, it, msg, extra) {
            var o = { sev: sev, code: code, f: it ? it.f : -1, frameId: it ? frames[it.f].id : null, s: it ? it.t.s : -1, msg: msg, ex: it ? excerpt(frames[it.f].text, it.t.s, it.t.e) : '' };
            if (extra) { o.extra = extra; }
            issues.push(o);
        }
        var seen = {};
        for (i = 0; i < calls.length; i++) {
            t = calls[i].t;
            if (!noteMap[t.key] && !seen['m' + t.key]) {
                seen['m' + t.key] = true;
                issue('err', 'MISSING', calls[i], T('Appel ' + t.text + ' sans mention', 'Mark ' + t.text + ' has no note'));
            }
        }
        for (var k in noteMap) {
            if (!noteMap.hasOwnProperty(k)) { continue; }
            if (!callMap[k]) {
                t = noteMap[k][0].t;
                if (!t.weak) { issue('warn', 'ORPHAN', noteMap[k][0], T('Mention ' + t.text + ' sans appel dans le texte', 'Note ' + t.text + ' is never referenced')); }
            }
            if (noteMap[k].length > 1) {
                issue('err', 'DUPNOTE', noteMap[k][1], T('Mention ' + noteMap[k][0].t.text + ' en double (' + noteMap[k].length + ' fois)', 'Note ' + noteMap[k][0].t.text + ' defined ' + noteMap[k].length + ' times'));
            }
        }
        // Numérotation dans l'ordre de lecture / numbering in reading order
        var maps = { num: {}, par: {}, sym: {} }, changed = { num: false, par: false, sym: false }, fams = ['num', 'par', 'sym'], symSeq = SEQ_STAR;
        var allSyms = {}, q;
        for (i = 0; i < calls.length; i++) { if (calls[i].t.fam === 'sym') { allSyms[calls[i].t.sym] = true; } }
        for (i = 0; i < notes.length; i++) { if (notes[i].t.fam === 'sym') { allSyms[notes[i].t.sym] = true; } }
        for (q in allSyms) { if (allSyms.hasOwnProperty(q) && symRankIn(SEQ_STAR, q) < 0) { symSeq = SEQ_DAGGER; } }
        for (j = 0; j < fams.length; j++) {
            var fm = fams[j], firsts = [], fseen = {}, nextIdx, m = maps[fm], orphans = [];
            for (i = 0; i < calls.length; i++) {
                t = calls[i].t;
                if (t.fam !== fm || fseen[t.key]) { continue; }
                fseen[t.key] = true; firsts.push(calls[i]);
            }
            for (i = 0; i < firsts.length; i++) {
                var oldv = tokKeyVal(firsts[i].t), newv = fm === 'sym' ? symSeq[i] : i + 1;
                if (newv === undefined) { newv = oldv; }
                m[String(oldv)] = newv;
                if (String(newv) !== String(oldv)) { changed[fm] = true; }
            }
            for (k in noteMap) {
                if (!noteMap.hasOwnProperty(k) || callMap[k]) { continue; }
                t = noteMap[k][0].t;
                if (t.fam === fm && !t.weak) { orphans.push(t); }
            }
            orphans.sort(function (a, b) { return fm === 'sym' ? symRankIn(symSeq, a.sym) - symRankIn(symSeq, b.sym) : a.val - b.val; });
            nextIdx = firsts.length;
            for (i = 0; i < orphans.length; i++) {
                var ov = tokKeyVal(orphans[i]), nv = fm === 'sym' ? symSeq[nextIdx] : nextIdx + 1;
                if (nv === undefined) { nv = ov; }
                if (m[String(ov)] === undefined) { m[String(ov)] = nv; if (String(nv) !== String(ov)) { changed[fm] = true; } nextIdx++; }
            }
            if (changed[fm] && firsts.length) {
                var desc = [], shown = 0;
                for (i = 0; i < firsts.length && shown < 6; i++) {
                    var ov2 = tokKeyVal(firsts[i].t);
                    if (String(m[String(ov2)]) !== String(ov2)) { desc.push(markLabel(fm, ov2) + ' \u2192 ' + markLabel(fm, m[String(ov2)])); shown++; }
                }
                var inOrder = true;
                for (i = 0; i < firsts.length; i++) { if (String(m[String(tokKeyVal(firsts[i].t))]) !== String(tokKeyVal(firsts[i].t))) { inOrder = false; } }
                if (!inOrder) {
                    issue('warn', 'ORDER', firsts[0], T('Numérotation hors de l\'ordre de lecture : ', 'Numbering does not follow reading order: ') + desc.join(', '));
                }
            }
        }
        // Espaces, ponctuation, ordre des mentions / spaces, punctuation, note order
        for (i = 0; i < calls.length; i++) {
            t = calls[i].t;
            if (t.spaceAt >= 0) { issue('warn', 'SPACE', calls[i], T('Espace avant l\'appel ' + t.text, 'Space before mark ' + t.text)); }
            if (!t.arabic && opts.punct === 'fr' && t.punctBefore >= 0 && !t.abbrevDot) {
                issue('warn', 'PUNCT', calls[i], T('Appel ' + t.text + ' après la ponctuation (en français : avant)', 'Mark ' + t.text + ' after punctuation (French style: before)'));
            }
            if (!t.arabic && opts.punct === 'en' && t.punctAfter >= 0 && ',.;:'.indexOf(frames[calls[i].f].text.charAt(t.punctAfter)) >= 0) {
                issue('warn', 'PUNCT', calls[i], T('Appel ' + t.text + ' avant la ponctuation (en anglais : après)', 'Mark ' + t.text + ' before punctuation (English style: after)'));
            }
        }
        for (i = 0; i < frames.length; i++) {
            var blocks = reorderBlocks(frames[i].text, frames[i].toks, function (tk) { return tk.fam === 'sym' ? symRankIn(symSeq, tk.sym) : tk.val; });
            for (j = 0; j < blocks.length; j++) {
                issue('warn', 'NOTEORDER', { f: i, t: blocks[j].firstTok }, T('Mentions pas dans l\'ordre', 'Notes are not in order'));
            }
        }
        return { frames: frames, rtl: rtl, order: order, calls: calls, notes: notes, callMap: callMap, noteMap: noteMap, issues: issues, maps: maps, changed: changed, symSeq: symSeq };
    }

    /* ---------------- Mentions à remettre dans l'ordre / note blocks to re-sort ---------------- */
    // Paragraphes consécutifs commençant chacun par une mention de la même famille.
    // Consecutive paragraphs that each start with a note of the same family.
    function reorderBlocks(text, toks, rankFn) {
        var leads = [], i, out = [], run = [];
        for (i = 0; i < toks.length; i++) { if (toks[i].role === 'note' && toks[i].lead) { leads.push(toks[i]); } }
        function flush() {
            var k, sorted = true, ord = [];
            if (run.length > 1) {
                for (k = 1; k < run.length; k++) { if (rankFn(run[k]) < rankFn(run[k - 1])) { sorted = false; } }
                if (!sorted) {
                    for (k = 0; k < run.length; k++) { ord.push(k); }
                    ord.sort(function (a, b) { var ra = rankFn(run[a]), rb = rankFn(run[b]); if (ra < 0) { ra = 9999; } if (rb < 0) { rb = 9999; } return ra - rb || a - b; });
                    var paras = [], ns = [];
                    for (k = 0; k < run.length; k++) { paras.push({ start: run[k].paraStart, end: run[k].paraEnd, tok: run[k] }); }
                    for (k = 0; k < ord.length; k++) { ns.push(text.substring(paras[ord[k]].start, paras[ord[k]].end)); }
                    out.push({ start: paras[0].start, end: paras[paras.length - 1].end, paras: paras, order: ord, newStr: ns.join('\r'), firstTok: run[0] });
                }
            }
            run = [];
        }
        for (i = 0; i < leads.length; i++) {
            if (run.length && (leads[i].para !== run[run.length - 1].para + 1 || leads[i].fam !== run[0].fam)) { flush(); }
            run.push(leads[i]);
        }
        flush();
        return out;
    }

    /* ---------------- Plan des corrections / correction plan ---------------- */
    // Rend { frameIndex: [edits] } / returns edits per frame
    function planEdits(res, opts) {
        var per = {}, i, j, f, t, ed, all = res.calls.concat(res.notes), m, newv, repl;
        opts = opts || {};
        for (i = 0; i < all.length; i++) {
            t = all[i].t; f = all[i].f;
            ed = { s: t.s, e: t.e, ds: t.ds, dl: t.dl, repl: null, spaceAt: -1, mode: '', punctAt: -1, sup: t.sup, role: t.role };
            if (opts.renumber && res.changed[t.fam]) {
                m = res.maps[t.fam]; newv = m[String(tokKeyVal(t))];
                if (newv !== undefined && String(newv) !== String(tokKeyVal(t))) {
                    repl = t.fam === 'sym' ? newv : fmtNum(newv, t.script);
                    ed.repl = repl;
                }
            }
            if (t.role === 'call') {
                if (opts.fixSpace && t.spaceAt >= 0) { ed.spaceAt = t.spaceAt; }
                if (opts.fixPunct && !t.arabic) {
                    if (opts.punct === 'fr' && t.punctBefore >= 0 && !t.abbrevDot) { ed.mode = 'fr'; ed.punctAt = t.punctBefore; }
                    else if (opts.punct === 'en' && t.punctAfter >= 0 && ',.;:'.indexOf(res.frames[f].text.charAt(t.punctAfter)) >= 0) { ed.mode = 'en'; ed.punctAt = t.punctAfter; }
                }
            }
            if (ed.repl === null && ed.spaceAt < 0 && !ed.mode) { continue; }
            ed.oldCall = res.frames[f].text.substring(t.s, t.e);
            ed.newCall = ed.repl === null ? ed.oldCall : ed.oldCall.substring(0, t.ds - t.s) + ed.repl + ed.oldCall.substring(t.ds - t.s + t.dl);
            (per[f] = per[f] || []).push(ed);
        }
        for (j in per) { if (per.hasOwnProperty(j)) { per[j].sort(function (a, b) { return b.s - a.s; }); } }
        return per;
    }

    // Applique les corrections d'un bloc sur un « modèle » de texte (DOM réel ou chaîne simulée).
    // Applies one frame's edits to a text model: { len(), ch(i), setChar(i, s), remove(i), setSuper(i, n) }.
    // Toujours de droite à gauche pour garder les positions valides / always right to left.
    function applyEdits(model, edits) {
        var i, ed, k, done = 0;
        for (i = 0; i < edits.length; i++) {
            ed = edits[i];
            var doReplace = function () {
                if (ed.repl === null) { return; }
                model.setChar(ed.ds, ed.repl);
                for (k = 1; k < ed.dl; k++) { model.remove(ed.ds + ed.repl.length); }
            };
            if (ed.mode === 'fr') {
                var pc = model.ch(ed.punctAt), e = ed.e;
                if (e < model.len() && !isBreak(model.ch(e))) {
                    model.setChar(e, pc + model.ch(e));
                    doReplace();
                    if (ed.spaceAt >= 0) { model.remove(ed.spaceAt); }
                    model.remove(ed.punctAt);
                } else {
                    doReplace();
                    for (k = 0; k < ed.newCall.length; k++) { model.remove(ed.s); }
                    if (ed.spaceAt >= 0) { model.remove(ed.spaceAt); }
                    model.setChar(ed.punctAt, ed.newCall + pc);
                    if (ed.sup) { model.setSuper(ed.punctAt, ed.newCall.length); }
                }
            } else if (ed.mode === 'en') {
                var pc2 = model.ch(ed.punctAt), w = (ed.spaceAt >= 0 ? ed.spaceAt : ed.s) - 1;
                model.remove(ed.punctAt);
                doReplace();
                if (ed.spaceAt >= 0) { model.remove(ed.spaceAt); }
                if (w >= 0) { model.setChar(w, model.ch(w) + pc2); }
            } else {
                doReplace();
                if (ed.spaceAt >= 0) { model.remove(ed.spaceAt); }
            }
            done++;
        }
        return done;
    }

    // Modèle chaîne pour les tests / string model for tests
    function StringModel(s) { this.s = s; this.sups = []; }
    StringModel.prototype.len = function () { return this.s.length; };
    StringModel.prototype.ch = function (i) { return this.s.charAt(i); };
    StringModel.prototype.setChar = function (i, v) { this.s = this.s.substring(0, i) + v + this.s.substring(i + 1); };
    StringModel.prototype.remove = function (i) { this.s = this.s.substring(0, i) + this.s.substring(i + 1); };
    StringModel.prototype.setSuper = function (i, n) { this.sups.push([i, n]); };

    // Mentions manquantes à créer / missing notes to create (after renumbering)
    function planMissing(res, opts) {
        var out = [], k, t, newv, label, i, best = -1, bestN = 0, cnt = {}, script = 'sup', supFmt = false, ar = false;
        for (i = 0; i < res.notes.length; i++) { if (res.notes[i].t.lead) { cnt[res.notes[i].f] = (cnt[res.notes[i].f] || 0) + 1; } }
        for (k in cnt) { if (cnt.hasOwnProperty(k) && cnt[k] > bestN) { bestN = cnt[k]; best = Number(k); } }
        for (k in res.callMap) {
            if (!res.callMap.hasOwnProperty(k) || res.noteMap[k]) { continue; }
            t = res.callMap[k][0].t;
            newv = tokKeyVal(t);
            if (opts && opts.renumber && res.changed[t.fam] && res.maps[t.fam][String(newv)] !== undefined) { newv = res.maps[t.fam][String(newv)]; }
            if (t.arabic) { ar = true; }
            out.push({ fam: t.fam, val: newv, arabic: t.arabic, rank: t.fam === 'sym' ? symRankIn(res.symSeq, newv) : newv });
        }
        out.sort(function (a, b) { return (a.fam < b.fam ? -1 : a.fam > b.fam ? 1 : 0) || a.rank - b.rank; });
        if (best >= 0) {
            for (i = 0; i < res.notes.length; i++) { if (res.notes[i].f === best && res.notes[i].t.lead && res.notes[i].t.fam === 'num') { script = res.notes[i].t.script; supFmt = res.notes[i].t.sup; break; } }
        }
        for (i = 0; i < out.length; i++) {
            label = out[i].fam === 'num' ? fmtNum(out[i].val, script) : (out[i].fam === 'par' ? '(' + out[i].val + ')' : out[i].val);
            out[i].marker = label;
            out[i].supFmt = out[i].fam === 'num' && supFmt;
            out[i].line = label + ' ' + (out[i].arabic ? '\u0646\u0635 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0644\u0644\u0625\u0643\u0645\u0627\u0644' : T('Mention \u00E0 compl\u00E9ter', 'Note to be completed'));
        }
        return { frame: best, items: out, arabic: ar };
    }

    function summarize(results) {
        var o = { err: 0, warn: 0, calls: 0, notes: 0 }, i, j;
        for (i = 0; i < results.length; i++) {
            o.calls += results[i].res.calls.length; o.notes += results[i].res.notes.length;
            for (j = 0; j < results[i].res.issues.length; j++) { o[results[i].res.issues[j].sev]++; }
        }
        return o;
    }

    /* ---------------- Réglages / settings ---------------- */
    var CFG_KEYS = ['scope', 'link', 'dir', 'famNum', 'famPar', 'famSym', 'punct', 'units', 'renumber', 'reorder', 'fixSpace', 'fixPunct', 'createMissing', 'marks'];
    function defaults() {
        return { scope: 'all', link: 'artboard', dir: 'auto', famNum: true, famPar: true, famSym: true, punct: 'fr', units: DEFAULT_UNITS,
            renumber: true, reorder: true, fixSpace: true, fixPunct: true, createMissing: false, marks: true };
    }
    function num(s, d) { var v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? d : v; }
    function serialize(o) {
        var s = 'AppelsDeNotes ' + VERSION + '\n', i, k;
        for (i = 0; i < CFG_KEYS.length; i++) { k = CFG_KEYS[i]; s += k + '=' + String(o[k]).replace(/[\r\n]+/g, ' ') + '\n'; }
        return s;
    }
    function deserialize(txt, base) {
        var o = base || defaults(), d = defaults(), lines = String(txt).split(/\r?\n/), i, p, k, v;
        for (i = 0; i < lines.length; i++) {
            p = lines[i].indexOf('=');
            if (p <= 0) { continue; }
            k = lines[i].substr(0, p); v = lines[i].substr(p + 1);
            if (!d.hasOwnProperty(k)) { continue; }
            if (typeof d[k] === 'boolean') { o[k] = v === 'true'; } else if (typeof d[k] === 'number') { o[k] = num(v, d[k]); } else { o[k] = v; }
        }
        return o;
    }
    function cfgFile() { try { return new File(Folder.userData + '/AppelsDeNotes_settings.txt'); } catch (e) { return null; } }
    function loadCfg() {
        var f = cfgFile(), o = defaults(), t;
        try { if (f && f.exists) { f.encoding = 'UTF-8'; f.open('r'); t = f.read(); f.close(); o = deserialize(t, o); } } catch (e) { }
        return o;
    }
    function saveCfg(o) { var f = cfgFile(); try { if (f) { f.encoding = 'UTF-8'; f.open('w'); f.write(serialize(o)); f.close(); } } catch (e) { } }
    function engineOpts(o) {
        return { fam: { num: !!o.famNum, par: !!o.famPar, sym: !!o.famSym }, unitsMap: parseUnits(o.units), rtl: o.dir, punct: o.punct,
            renumber: !!o.renumber, fixSpace: !!o.fixSpace, fixPunct: !!o.fixPunct && o.punct !== 'off' };
    }

    /* ================================================================== */
    /* DOCUMENT ILLUSTRATOR / ILLUSTRATOR DOCUMENT                          */
    /* ================================================================== */
    var MARK_LAYER = 'AppelsDeNotes \u2013 contr\u00F4le';

    function isSupAttr(a) {
        try {
            if (String(a.baselinePosition).indexOf('SUPERSCRIPT') >= 0) { return true; }
        } catch (e1) { }
        try {
            if (String(a.openTypePosition).indexOf('SUPERSCRIPT') >= 0) { return true; }
        } catch (e2) { }
        try {
            if (a.baselineShift > 0 && a.baselineShift >= a.size * 0.18) { return true; }
        } catch (e3) { }
        return false;
    }
    function layerOf(it) {
        var p = it;
        try { while (p && p.typename !== 'Layer') { p = p.parent; } } catch (e) { return null; }
        return p;
    }
    function isShown(it) {
        var p = it;
        try {
            if (it.hidden) { return false; }
            while (p && p.typename !== 'Document') {
                if (p.typename === 'Layer' && !p.visible) { return false; }
                if (p.hidden) { return false; }
                p = p.parent;
            }
        } catch (e) { }
        return true;
    }
    function isEditable(it) {
        var p = it;
        try {
            if (it.locked) { return false; }
            while (p && p.typename !== 'Document') { if (p.locked) { return false; } p = p.parent; }
        } catch (e) { }
        return true;
    }
    function inMarkLayer(it) { var l = layerOf(it); try { return !!l && l.name === MARK_LAYER; } catch (e) { return false; } }
    function collectSelFrames(sel, out) {
        var i, it;
        for (i = 0; i < sel.length; i++) {
            it = sel[i];
            try {
                if (it.typename === 'TextFrame') { out.push(it); }
                else if (it.typename === 'GroupItem') { collectSelFrames(it.pageItems, out); }
            } catch (e) { }
        }
    }
    function selectionFrames(doc) {
        var out = [], sel;
        try { sel = doc.selection; } catch (e) { sel = null; }
        if (!sel) { return out; }
        try {
            if (sel.typename === 'TextRange') {
                var fs = sel.story.textFrames, i;
                for (i = 0; i < fs.length; i++) { out.push(fs[i]); }
                return out;
            }
        } catch (e2) { }
        if (sel.length) { collectSelFrames(sel, out); }
        return out;
    }
    function artboardIndexOf(doc, box) {
        var cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, i, r, best = -1, bd = Infinity, d;
        for (i = 0; i < doc.artboards.length; i++) {
            r = doc.artboards[i].artboardRect;
            if (cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) { return i; }
            d = Math.max(r[0] - cx, 0, cx - r[2]) + Math.max(cy - r[1], 0, r[3] - cy);
            if (d < bd) { bd = d; best = i; }
        }
        return bd < 36 ? best : -1;
    }

    // Lit les blocs de texte et leurs marques / reads text frames and their marks
    function readFrames(doc, o, eo) {
        var list = [], frames = [], i, tf, ab = -1, act = 0;
        try { act = doc.artboards.getActiveArtboardIndex(); } catch (e0) { act = 0; }
        if (o.scope === 'selection') { list = selectionFrames(doc); }
        else { for (i = 0; i < doc.textFrames.length; i++) { list.push(doc.textFrames[i]); } }
        for (i = 0; i < list.length; i++) {
            tf = list[i];
            if (!isShown(tf) || inMarkLayer(tf)) { continue; }
            var box, text, chs, nChars, aligned = true, cache = {};
            try { box = tf.geometricBounds; text = String(tf.contents); } catch (e1) { continue; }
            if (!text) { continue; }
            ab = artboardIndexOf(doc, box);
            if (o.scope === 'artboard' && ab !== act) { continue; }
            try { chs = tf.characters; nChars = chs.length; } catch (e2) { chs = null; nChars = -1; }
            if (nChars !== text.length) { aligned = false; }
            var supAt = (function (chs0, ok, c0) {
                return function (k) {
                    if (!ok || !chs0) { return false; }
                    if (c0[k] === undefined) { try { c0[k] = isSupAttr(chs0[k].characterAttributes); } catch (e3) { c0[k] = false; } }
                    return c0[k];
                };
            })(chs, aligned, cache);
            var toks = parseText(text, supAt, eo);
            var cs = countScripts(text);
            frames.push({ id: frames.length, tf: tf, box: box, text: text, toks: toks, ab: ab, aligned: aligned, editable: isEditable(tf), ar: cs.ar, la: cs.la });
        }
        return frames;
    }
    function groupFrames(frames, o) {
        var g = {}, keys = [], i, k, out = [];
        for (i = 0; i < frames.length; i++) {
            k = o.link === 'document' ? 'doc' : String(frames[i].ab);
            if (!g[k]) { g[k] = []; keys.push(k); }
            g[k].push(frames[i]);
        }
        keys.sort(function (a, b) { return Number(a) - Number(b); });
        for (i = 0; i < keys.length; i++) { out.push({ key: keys[i], frames: g[keys[i]] }); }
        return out;
    }
    function analyzeDoc(doc, o) {
        var eo = engineOpts(o), frames = readFrames(doc, o, eo), groups = groupFrames(frames, o), i, results = [], local, j;
        for (i = 0; i < groups.length; i++) {
            local = [];
            for (j = 0; j < groups[i].frames.length; j++) { local.push(groups[i].frames[j]); }
            results.push({ key: groups[i].key, frames: local, res: analyzeGroup(local, eo) });
        }
        return { frames: frames, results: results, eo: eo };
    }
    function groupLabel(doc, key) {
        if (key === 'doc') { return T('Document', 'Document'); }
        if (key === '-1') { return T('Hors plan', 'Off artboard'); }
        var n = '';
        try { n = doc.artboards[Number(key)].name; } catch (e) { }
        return T('Plan ', 'Artboard ') + (Number(key) + 1) + (n ? ' \u00AB ' + n + ' \u00BB' : '');
    }
    function reportLines(doc, an) {
        var lines = [], i, j, is, r, sym;
        for (i = 0; i < an.results.length; i++) {
            r = an.results[i];
            for (j = 0; j < r.res.issues.length; j++) {
                is = r.res.issues[j];
                sym = is.sev === 'err' ? '\u2716' : '\u26A0';
                lines.push({ text: (lines.length + 1) + '. ' + sym + ' [' + groupLabel(doc, r.key) + '] ' + is.msg + (is.ex ? ' \u2014 ' + is.ex : ''), frame: is.f >= 0 ? r.frames[is.f] : null, issue: is });
            }
        }
        return lines;
    }

    /* ---------------- Modèle de texte réel / real text model ---------------- */
    function DomModel(tf) { this.tf = tf; }
    DomModel.prototype.len = function () { return this.tf.characters.length; };
    DomModel.prototype.ch = function (i) { return String(this.tf.characters[i].contents); };
    DomModel.prototype.setChar = function (i, v) { this.tf.characters[i].contents = v; };
    DomModel.prototype.remove = function (i) { this.tf.characters[i].remove(); };
    DomModel.prototype.setSuper = function (i, n) {
        var k;
        for (k = 0; k < n; k++) { try { this.tf.characters[i + k].characterAttributes.baselinePosition = FontBaselineOption.SUPERSCRIPT; } catch (e) { } }
    };

    // Trouve l'objet paragraphe qui commence à la position start / finds the paragraph object at offset start
    function findParagraph(tf, start, len) {
        var ps = tf.paragraphs, txt = String(tf.contents), pos = 0, i, c, at;
        for (i = 0; i < ps.length; i++) {
            c = String(ps[i].contents);
            if (!c.length) { continue; }
            at = txt.indexOf(c, pos);
            if (at < 0) { return null; }
            if (at === start && c.length === len) { return ps[i]; }
            if (at > start) { return null; }
            pos = at + c.length;
        }
        return null;
    }
    function dupParagraphAt(tf, para, at) {
        var len = String(para.contents).length;
        para.duplicate(tf.insertionPoints[at], ElementPlacement.PLACEBEFORE);
        tf.insertionPoints[at + len].characters.add('\r');
        return len + 1;
    }
    // Vérifie une fois que la copie de paragraphes se comporte comme prévu / one-time API self-check
    var PROBE = null;
    function probeReorder(doc) {
        var tf, ok = false, p;
        if (PROBE !== null) { return PROBE; }
        try {
            tf = doc.textFrames.add();
            tf.contents = 'A\rB';
            p = findParagraph(tf, 2, 1);
            if (p) { dupParagraphAt(tf, p, 0); ok = String(tf.contents) === 'B\rA\rB'; }
        } catch (e) { ok = false; }
        try { if (tf) { tf.remove(); } } catch (e2) { }
        PROBE = ok;
        return ok;
    }
    // Remet un bloc de mentions dans l'ordre en gardant toute la mise en forme.
    // Re-sorts one block of notes, keeping all formatting (paragraph copies, then removal of the old block).
    function domReorder(tf, block) {
        var text = String(tf.contents), S = block.start, ins = 0, k, p, para, oldLen = block.end - block.start, expect, built = '';
        for (k = block.order.length - 1; k >= 0; k--) {
            p = block.paras[block.order[k]];
            para = findParagraph(tf, p.start + ins, p.end - p.start);
            if (!para) { return k === block.order.length - 1 ? 'skip' : 'broken'; }
            ins += dupParagraphAt(tf, para, S);
            built = text.substring(p.start, p.end) + '\r' + built;
            expect = text.substring(0, S) + built + text.substring(S);
            if (String(tf.contents) !== expect) { return 'broken'; }
        }
        for (k = 0; k < oldLen + 1; k++) { tf.characters[S + ins - 1].remove(); }
        expect = text.substring(0, S) + block.newStr + text.substring(block.end);
        return String(tf.contents) === expect ? 'ok' : 'broken';
    }

    function makeColor(doc, kind) {
        var c;
        try {
            if (String(doc.documentColorSpace).indexOf('CMYK') >= 0) {
                c = new CMYKColor();
                if (kind === 'red') { c.cyan = 0; c.magenta = 100; c.yellow = 100; c.black = 0; } else { c.cyan = 0; c.magenta = 100; c.yellow = 0; c.black = 0; }
            } else {
                c = new RGBColor();
                if (kind === 'red') { c.red = 230; c.green = 0; c.blue = 30; } else { c.red = 230; c.green = 0; c.blue = 160; }
            }
        } catch (e) { c = null; }
        return c;
    }
    function removeMarkLayer(doc) {
        var i;
        try { for (i = doc.layers.length - 1; i >= 0; i--) { if (doc.layers[i].name === MARK_LAYER) { doc.layers[i].locked = false; doc.layers[i].remove(); } } } catch (e) { }
    }
    // Repères de contrôle sur un calque non imprimable / review marks on a non-printing layer
    function drawMarks(doc, lines) {
        var lay, i, byFrame = {}, keys = [], k, f, b, r, t, red = makeColor(doc, 'red');
        removeMarkLayer(doc);
        if (!lines.length) { return 0; }
        lay = doc.layers.add(); lay.name = MARK_LAYER;
        try { lay.printable = false; } catch (e0) { }
        for (i = 0; i < lines.length; i++) {
            if (!lines[i].frame) { continue; }
            k = String(lines[i].frame.id);
            if (!byFrame[k]) { byFrame[k] = { f: lines[i].frame, n: [] }; keys.push(k); }
            byFrame[k].n.push(i + 1);
        }
        for (i = 0; i < keys.length; i++) {
            f = byFrame[keys[i]].f; b = f.box;
            try {
                r = lay.pathItems.rectangle(b[1] + 2, b[0] - 2, (b[2] - b[0]) + 4, (b[1] - b[3]) + 4);
                r.filled = false; r.stroked = true; r.strokeWidth = 1; if (red) { r.strokeColor = red; }
                t = lay.textFrames.add(); t.contents = '#' + byFrame[keys[i]].n.join(' #');
                t.textRange.characterAttributes.size = 6; if (red) { t.textRange.characterAttributes.fillColor = red; }
                t.position = [b[0] - 2, b[1] + 10];
            } catch (e1) { }
        }
        return keys.length;
    }

    function createMissing(doc, r, plan) {
        var i, tf, f, made = 0, base, k, it, lines = [], ab, mag;
        if (!plan.items.length) { return 0; }
        if (plan.frame >= 0 && r.frames[plan.frame].editable && r.frames[plan.frame].aligned) {
            tf = r.frames[plan.frame].tf;
            for (i = 0; i < plan.items.length; i++) {
                it = plan.items[i];
                try {
                    base = tf.characters.length;
                    tf.insertionPoints[tf.insertionPoints.length - 1].characters.add('\r' + it.line);
                    if (it.supFmt) { for (k = 0; k < it.marker.length; k++) { tf.characters[base + 1 + k].characterAttributes.baselinePosition = FontBaselineOption.SUPERSCRIPT; } }
                    made++;
                } catch (e1) { }
            }
            return made;
        }
        for (i = 0; i < plan.items.length; i++) { lines.push(plan.items[i].line); }
        try {
            f = r.frames[0];
            ab = f.ab >= 0 ? doc.artboards[f.ab].artboardRect : f.box;
            var lay = doc.activeLayer;
            if (lay.locked || !lay.visible || lay.name === MARK_LAYER) { lay = doc.layers.add(); lay.name = T('Mentions', 'Notes'); }
            tf = lay.textFrames.add();
            tf.contents = lines.join('\r');
            tf.name = T('Mentions \u00E0 compl\u00E9ter (AppelsDeNotes)', 'Notes to complete (AppelsDeNotes)');
            tf.textRange.characterAttributes.size = 6;
            mag = makeColor(doc, 'magenta'); if (mag) { tf.textRange.characterAttributes.fillColor = mag; }
            if (plan.arabic) { try { tf.textRange.paragraphAttributes.paragraphDirection = ParagraphDirectionType.RIGHT_TO_LEFT_DIRECTION; } catch (e2) { } }
            tf.position = [ab[0] + 5 * MM, ab[3] + 5 * MM + lines.length * 7.2];
            made = lines.length;
        } catch (e3) { }
        return made;
    }

    // Applique toutes les corrections cochées / applies all ticked corrections
    function applyFixes(doc, an, o) {
        var eo = engineOpts(o), stats = { edits: 0, reordered: 0, created: 0, skipped: 0, broken: 0 }, i, j, r, per, f, missing = [];
        for (i = 0; i < an.results.length; i++) {
            r = an.results[i];
            if (o.createMissing) { missing.push({ r: r, plan: planMissing(r.res, eo) }); }
            per = planEdits(r.res, eo);
            for (j in per) {
                if (!per.hasOwnProperty(j)) { continue; }
                f = r.frames[Number(j)];
                if (!f.editable || !f.aligned) { stats.skipped += per[j].length; continue; }
                try { stats.edits += applyEdits(new DomModel(f.tf), per[j]); } catch (e1) { stats.broken++; }
            }
        }
        for (i = 0; i < missing.length; i++) { stats.created += createMissing(doc, missing[i].r, missing[i].plan); }
        if (o.reorder) {
            var an2 = analyzeDoc(doc, o), res, blocks, k;
            for (i = 0; i < an2.results.length; i++) {
                res = an2.results[i].res;
                for (j = 0; j < an2.results[i].frames.length; j++) {
                    f = an2.results[i].frames[j];
                    blocks = reorderBlocks(f.text, f.toks, function (tk) { return tk.fam === 'sym' ? symRankIn(res.symSeq, tk.sym) : tk.val; });
                    if (!blocks.length) { continue; }
                    if (!f.editable || !f.aligned || !probeReorder(doc)) { stats.skipped += blocks.length; continue; }
                    for (k = blocks.length - 1; k >= 0; k--) {
                        var st = 'broken';
                        try { st = domReorder(f.tf, blocks[k]); } catch (e2) { st = 'broken'; }
                        if (st === 'ok') { stats.reordered++; } else if (st === 'skip') { stats.skipped++; } else { stats.broken++; break; }
                    }
                }
            }
        }
        return stats;
    }

    /* ================================================================== */
    /* FENÊTRES / DIALOGS (ScriptUI)                                        */
    /* ================================================================== */
    function settingsDialog(o, hasSel) {
        var w = new Window('dialog', T('Appels de notes ', 'Footnote marks ') + VERSION), p, g, ddScope, ddDir, ddPunct, rbAb, rbDoc, cN, cP, cS, etU;
        w.orientation = 'column'; w.alignChildren = 'fill';
        w.add('statictext', undefined, T('Relie chaque appel (¹, (1), *, †) à sa mention et contr\u00F4le la num\u00E9rotation.', 'Links every mark (¹, (1), *, †) to its note and checks the numbering.'));
        p = w.add('panel', undefined, T('Port\u00E9e', 'Scope')); p.alignChildren = 'left';
        ddScope = p.add('dropdownlist', undefined, [T('Textes s\u00E9lectionn\u00E9s', 'Selected text'), T('Plan de travail actif', 'Active artboard'), T('Tous les plans de travail', 'All artboards')]);
        ddScope.selection = o.scope === 'selection' ? 0 : (o.scope === 'artboard' ? 1 : 2);
        if (!hasSel && o.scope === 'selection') { ddScope.selection = 2; }
        g = p.add('group'); g.add('statictext', undefined, T('Chercher la mention :', 'Look for the note:'));
        rbAb = g.add('radiobutton', undefined, T('sur le m\u00EAme plan de travail', 'on the same artboard'));
        rbDoc = g.add('radiobutton', undefined, T('dans tout le document', 'anywhere in the document'));
        rbAb.value = o.link !== 'document'; rbDoc.value = o.link === 'document';
        g = p.add('group'); g.add('statictext', undefined, T('Sens de lecture :', 'Reading direction:'));
        ddDir = g.add('dropdownlist', undefined, [T('Automatique (selon l\'\u00E9criture)', 'Automatic (by script)'), T('Gauche \u2192 droite', 'Left \u2192 right'), T('Droite \u2192 gauche (arabe)', 'Right \u2192 left (Arabic)')]);
        ddDir.selection = o.dir === 'ltr' ? 1 : (o.dir === 'rtl' ? 2 : 0);
        p = w.add('panel', undefined, T('Marques reconnues', 'Recognised marks')); p.alignChildren = 'left';
        cN = p.add('checkbox', undefined, T('Chiffres en exposant : \u00B9 \u00B2 \u00B3 ou chiffres mis en exposant (aussi \u0661 \u0662 \u0663)', 'Superscript numbers: \u00B9 \u00B2 \u00B3 or digits set as superscript (also \u0661 \u0662 \u0663)')); cN.value = o.famNum;
        cP = p.add('checkbox', undefined, T('Num\u00E9ros entre parenth\u00E8ses coll\u00E9s au mot : Prix TTC(1)', 'Numbers in parentheses after a word: Price(1)')); cP.value = o.famPar;
        cS = p.add('checkbox', undefined, T('Symboles : *  **  \u2020  \u2021  \u00A7', 'Symbols: *  **  \u2020  \u2021  \u00A7')); cS.value = o.famSym;
        g = p.add('group'); g.add('statictext', undefined, T('Unit\u00E9s (\u00B2 \u00B3 ignor\u00E9s apr\u00E8s) :', 'Units (\u00B2 \u00B3 ignored after):'));
        etU = g.add('edittext', undefined, o.units); etU.characters = 30;
        p = w.add('panel', undefined, T('Typographie', 'Typography')); p.alignChildren = 'left';
        g = p.add('group'); g.add('statictext', undefined, T('Appel et ponctuation :', 'Mark and punctuation:'));
        ddPunct = g.add('dropdownlist', undefined, [T('Ne pas v\u00E9rifier', 'Do not check'), T('Fran\u00E7ais : appel avant . , ; : ! ?', 'French: mark before . , ; : ! ?'), T('Anglais : appel apr\u00E8s . , ; :', 'English: mark after . , ; :')]);
        ddPunct.selection = o.punct === 'off' ? 0 : (o.punct === 'en' ? 2 : 1);
        w.add('statictext', undefined, T('Conseil : travaillez sur une copie. Rien n\'est modifi\u00E9 avant l\'\u00E9tape suivante.', 'Tip: work on a copy. Nothing is changed before the next step.'));
        g = w.add('group'); g.alignment = 'right';
        g.add('button', undefined, T('Annuler', 'Cancel'), { name: 'cancel' });
        g.add('button', undefined, T('Analyser', 'Analyse'), { name: 'ok' });
        if (w.show() !== 1) { return null; }
        o.scope = ['selection', 'artboard', 'all'][ddScope.selection.index];
        o.link = rbDoc.value ? 'document' : 'artboard';
        o.dir = ['auto', 'ltr', 'rtl'][ddDir.selection.index];
        o.famNum = cN.value; o.famPar = cP.value; o.famSym = cS.value;
        o.units = etU.text;
        o.punct = ['off', 'fr', 'en'][ddPunct.selection.index];
        return o;
    }

    function reportDialog(doc, an, lines, o) {
        var w = new Window('dialog', T('Appels de notes \u2014 rapport', 'Footnote marks \u2014 report')), s = summarize(an.results), lb, i, g, p, cR, cO, cSp, cPu, cM, cK, anyChange = false, cnt = { SPACE: 0, PUNCT: 0, MISSING: 0, NOTEORDER: 0 };
        w.orientation = 'column'; w.alignChildren = 'fill';
        for (i = 0; i < an.results.length; i++) { if (an.results[i].res.changed.num || an.results[i].res.changed.par || an.results[i].res.changed.sym) { anyChange = true; } }
        for (i = 0; i < lines.length; i++) { if (cnt[lines[i].issue.code] !== undefined) { cnt[lines[i].issue.code]++; } }
        w.add('statictext', undefined, T(s.calls + ' appel(s), ' + s.notes + ' mention(s) \u2014 ' + s.err + ' erreur(s), ' + s.warn + ' avertissement(s).',
            s.calls + ' mark(s), ' + s.notes + ' note(s) \u2014 ' + s.err + ' error(s), ' + s.warn + ' warning(s).'));
        lb = w.add('listbox', undefined, [], { multiselect: false });
        lb.preferredSize = [720, 260];
        if (!lines.length) { lb.add('item', T('Aucun probl\u00E8me trouv\u00E9 : chaque appel a sa mention, dans l\'ordre.', 'No problem found: every mark has its note, in order.')); }
        for (i = 0; i < lines.length; i++) { lb.add('item', lines[i].text); }
        lb.onChange = function () {
            var it = lb.selection;
            if (!it || it.index >= lines.length || !lines[it.index].frame) { return; }
            try { doc.selection = null; lines[it.index].frame.tf.selected = true; app.redraw(); } catch (e) { }
        };
        w.add('statictext', undefined, T('Cliquez sur une ligne pour s\u00E9lectionner le bloc concern\u00E9.', 'Click a line to select the text frame.'));
        p = w.add('panel', undefined, T('Corrections', 'Corrections')); p.alignChildren = 'left';
        cR = p.add('checkbox', undefined, T('Renum\u00E9roter dans l\'ordre de lecture (appels et mentions ensemble)', 'Renumber in reading order (marks and notes together)'));
        cR.value = o.renumber && anyChange; cR.enabled = anyChange;
        cO = p.add('checkbox', undefined, T('Remettre les mentions dans l\'ordre (paragraphes d\'un m\u00EAme bloc, mise en forme gard\u00E9e)', 'Re-sort the notes (paragraphs of one frame, formatting kept)')); cO.value = o.reorder;
        cSp = p.add('checkbox', undefined, T('Supprimer l\'espace avant l\'appel (' + cnt.SPACE + ')', 'Remove the space before the mark (' + cnt.SPACE + ')')); cSp.value = o.fixSpace; cSp.enabled = cnt.SPACE > 0;
        cPu = p.add('checkbox', undefined, T('Placer l\'appel selon la r\u00E8gle de ponctuation choisie (' + cnt.PUNCT + ')', 'Move the mark per the chosen punctuation rule (' + cnt.PUNCT + ')')); cPu.value = o.fixPunct; cPu.enabled = cnt.PUNCT > 0;
        cM = p.add('checkbox', undefined, T('Cr\u00E9er les mentions manquantes \u00AB \u00E0 compl\u00E9ter \u00BB (' + cnt.MISSING + ')', 'Create "to be completed" placeholders for missing notes (' + cnt.MISSING + ')')); cM.value = o.createMissing; cM.enabled = cnt.MISSING > 0;
        cK = p.add('checkbox', undefined, T('Rep\u00E8res de contr\u00F4le sur un calque non imprimable', 'Review marks on a non-printing layer')); cK.value = o.marks;
        g = w.add('group'); g.alignment = 'right';
        g.add('button', undefined, T('Fermer', 'Close'), { name: 'cancel' });
        var bMarks = g.add('button', undefined, T('Rep\u00E8res seulement', 'Marks only'));
        var bFix = g.add('button', undefined, T('Corriger', 'Fix'), { name: 'ok' });
        var action = 'close';
        bMarks.onClick = function () { action = 'marks'; w.close(2); };
        bFix.onClick = function () { action = 'fix'; w.close(1); };
        w.show();
        o.renumber = cR.enabled ? cR.value : o.renumber; o.reorder = cO.value;
        o.fixSpace = cSp.enabled ? cSp.value : o.fixSpace; o.fixPunct = cPu.enabled ? cPu.value : o.fixPunct;
        o.createMissing = cM.enabled ? cM.value : o.createMissing; o.marks = cK.value;
        if (action === 'fix' && !cR.value) { o.renumberNow = false; } else { o.renumberNow = cR.value; }
        return action;
    }

    function run(doc, o, ui) {
        var an = analyzeDoc(doc, o), lines = reportLines(doc, an), s = summarize(an.results), action, st, an2, lines2, s2, oo, k;
        if (!an.frames.length) {
            ui.alert(T('Aucun texte \u00E0 analyser dans la port\u00E9e choisie.', 'No text to analyse in the chosen scope.'));
            return { action: 'none' };
        }
        if (!s.calls && !s.notes) {
            removeMarkLayer(doc);
            ui.alert(T('Aucun appel de note ni aucune mention trouv\u00E9s (' + an.frames.length + ' bloc(s) de texte lus).', 'No footnote mark or note found (' + an.frames.length + ' text frame(s) read).'));
            return { action: 'none' };
        }
        action = ui.report(doc, an, lines, o);
        if (action === 'close') { return { action: action, summary: s }; }
        if (action === 'marks') { drawMarks(doc, lines); return { action: action, summary: s }; }
        oo = {};
        for (k in o) { if (o.hasOwnProperty(k)) { oo[k] = o[k]; } }
        oo.renumber = !!o.renumberNow;
        st = applyFixes(doc, an, oo);
        an2 = analyzeDoc(doc, o); lines2 = reportLines(doc, an2); s2 = summarize(an2.results);
        if (o.marks) { drawMarks(doc, lines2); } else { removeMarkLayer(doc); }
        ui.alert(T('Corrections faites : ' + st.edits + ' marque(s) modifi\u00E9e(s), ' + st.reordered + ' bloc(s) de mentions remis dans l\'ordre, ' + st.created + ' mention(s) cr\u00E9\u00E9e(s).' +
            (st.skipped ? '\n' + st.skipped + ' correction(s) ignor\u00E9e(s) (bloc verrouill\u00E9 ou texte sp\u00E9cial).' : '') +
            (st.broken ? '\nAttention : ' + st.broken + ' op\u00E9ration(s) n\'ont pas donn\u00E9 le r\u00E9sultat attendu. V\u00E9rifiez, ou faites Ctrl/Cmd+Z.' : '') +
            '\nReste : ' + s2.err + ' erreur(s), ' + s2.warn + ' avertissement(s).' + (o.marks && lines2.length ? '\nLes rep\u00E8res rouges (calque \u00AB ' + MARK_LAYER + ' \u00BB) montrent ce qui reste \u00E0 voir.' : ''),
            'Done: ' + st.edits + ' mark(s) changed, ' + st.reordered + ' note block(s) re-sorted, ' + st.created + ' note(s) created.' +
            (st.skipped ? '\n' + st.skipped + ' correction(s) skipped (locked frame or special text).' : '') +
            (st.broken ? '\nWarning: ' + st.broken + ' operation(s) did not give the expected result. Check, or press Ctrl/Cmd+Z.' : '') +
            '\nLeft: ' + s2.err + ' error(s), ' + s2.warn + ' warning(s).'));
        return { action: action, stats: st, summary: s, after: s2 };
    }

    function main() {
        var doc, o, hasSel;
        if (app.documents.length === 0) {
            alert(T('Aucun document ouvert.\nOuvrez un fichier contenant des appels de notes, puis relancez le script.', 'No open document.\nOpen a file with footnote marks, then run the script again.'));
            return;
        }
        doc = app.activeDocument;
        hasSel = selectionFrames(doc).length > 0;
        o = settingsDialog(loadCfg(), hasSel);
        if (!o) { return; }
        saveCfg(o);
        if (o.scope === 'selection' && !hasSel) {
            alert(T('Rien n\'est s\u00E9lectionn\u00E9.\nS\u00E9lectionnez des blocs de texte, ou choisissez \u00AB Tous les plans de travail \u00BB.', 'Nothing is selected.\nSelect text frames, or choose "All artboards".'));
            return;
        }
        run(doc, o, { alert: function (s) { alert(s); }, report: reportDialog });
        saveCfg(o);
    }

    return {
        VERSION: VERSION, T: T, setLang: setLang, SUPD: SUPD, SEQ_DAGGER: SEQ_DAGGER, SEQ_STAR: SEQ_STAR, DEFAULT_UNITS: DEFAULT_UNITS,
        supVal: supVal, digitVal: digitVal, fmtNum: fmtNum, isArabicLetter: isArabicLetter, isLatinLetter: isLatinLetter, parseUnits: parseUnits,
        parseText: parseText, readingOrder: readingOrder, analyzeGroup: analyzeGroup, reorderBlocks: reorderBlocks, planEdits: planEdits,
        applyEdits: applyEdits, StringModel: StringModel, planMissing: planMissing, summarize: summarize, countScripts: countScripts,
        defaults: defaults, serialize: serialize, deserialize: deserialize, engineOpts: engineOpts, isSupAttr: isSupAttr,
        readFrames: readFrames, analyzeDoc: analyzeDoc, reportLines: reportLines, DomModel: DomModel, findParagraph: findParagraph,
        probeReorder: probeReorder, domReorder: domReorder, applyFixes: applyFixes, drawMarks: drawMarks, createMissing: createMissing,
        run: run, main: main, MARK_LAYER: MARK_LAYER, resetProbe: function () { PROBE = null; }
    };
})();

if (typeof ADN_NO_AUTORUN === 'undefined') { ADN.main(); }
