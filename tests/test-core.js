// Tests du moteur pur (sans Illustrator) / pure engine tests (no Illustrator)
var A = require('./load')().ADN;
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL: ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); }
function P(text, sups, opts) { var set = {}; (sups || []).forEach(function (i) { set[i] = true; }); return A.parseText(text, function (i) { return !!set[i]; }, opts); }
function roles(toks) { return toks.map(function (t) { return t.role + ':' + t.key + (t.loose ? '~' : '') + (t.weak ? '?' : '') + (t.lead ? '^' : ''); }); }
function frame(text, box, sups) { return { id: 0, box: box || [0, 100, 100, 0], text: text, toks: P(text, sups) }; }
function fix(frames, opts) {
    // analyse → corrections (chaînes) → réordonne → renvoie les textes / analyse → fix → re-sort
    opts = Object.assign({ renumber: true, fixSpace: true, fixPunct: true, punct: 'fr' }, opts || {});
    var res = A.analyzeGroup(frames, opts), per = A.planEdits(res, opts), out = [];
    frames.forEach(function (f, i) {
        var m = new A.StringModel(f.text); A.applyEdits(m, per[i] || []);
        var t = m.s, toks = P(t), res2 = A.analyzeGroup([{ id: 0, box: f.box, text: t, toks: toks }], opts);
        var bl = A.reorderBlocks(t, toks, function (tk) { return tk.fam === 'sym' ? A.SEQ_STAR.indexOf(tk.sym) : tk.val; });
        for (var k = bl.length - 1; k >= 0; k--) { t = t.substring(0, bl[k].start) + bl[k].newStr + t.substring(bl[k].end); }
        out.push(t);
    });
    return { res: res, texts: out };
}
function codes(res) { return res.issues.map(function (i) { return i.code; }).sort(); }

// 1. Exposants Unicode + mentions en début de paragraphe
var t1 = 'Prix 999 DA\u00B9 et livraison offerte\u00B2\r\u00B9 Offre valable jusqu\u2019au 30/11.\r\u00B2 Dans la limite des stocks.';
eq(roles(P(t1)), ['call:num:1', 'call:num:2', 'note:num:1^', 'note:num:2^'], 'exposants unicode');
// 2. Unités, maths, puissances de 10 : jamais des appels
eq(roles(P('Surface 120 m\u00B2, volume 3 cm\u00B3, x\u00B2 + y\u00B2, 10\u00B3 Pa, E=mc\u00B2, 25 \u0645\u00B2')), [], 'unités et exposants mathématiques ignorés');
eq(roles(P('Surface 3 km\u00B2, volume 3 cm\u00B3', [], { units: 'cm' })).length, 1, 'liste d’unités personnalisée (km retiré)');
eq(roles(P('10\u207B\u00B3 mol')), [], 'exposant négatif ignoré');
// 3. Chiffres mis en exposant par la mise en forme
eq(roles(P('Prix TTC1 seulement', [8])), ['call:num:1'], 'chiffre formaté en exposant');
eq(roles(P('Prix TTC12 seulement', [8, 9])), ['call:num:12'], 'deux chiffres formatés');
eq(roles(P('Prix TTC12 seulement', [8])), [], 'exposant partiel ignoré');
eq(roles(P('En 2024 nous avons 12 magasins')), [], 'chiffres normaux ignorés');
// 4. Parenthèses
eq(roles(P('Prix TTC(1) et frais(2).\r(1) Hors livraison.\r(2) Selon zone.')), ['call:par:1', 'call:par:2', 'note:par:1^', 'note:par:2^'], 'parenthèses');
eq(roles(P('Prix TTC (1) ici')), ['call:par:1~'], 'parenthèse détachée = appel lâche');
eq(roles(P('choisir (1) ou (2) puis')), ['call:par:1~', 'call:par:2~'], 'liste (1) (2) lâche');
// 5. Symboles
eq(roles(P('Livraison offerte*\r*Offre valable en Alg\u00E9rie.')), ['call:sym:*', 'note:sym:*^'], 'astérisque');
eq(roles(P('Prix* et cadeau**\r*Offre valable. **Dans la limite des stocks.')), ['call:sym:*', 'call:sym:**', 'note:sym:*^', 'note:sym:**'], 'mentions en ligne');
eq(roles(P('2*3=6 et f*ck')), [], 'multiplication et censure ignorées');
eq(roles(P('Voir \u00A7 12 et \u00A712')), [], '§ d’article ignoré');
eq(roles(P('Garantie\u2020 et \u2021\r\u2020 Deux ans.')), ['call:sym:\u2020', 'call:sym:\u2021~', 'note:sym:\u2020^'], 'dague ; ‡ isolé = appel lâche');
// 6. Arabe
var tA = '\u0627\u0644\u0633\u0639\u0631 \u0669\u0669\u0669 \u062F\u062C\u00B9\r\u00B9 \u0627\u0644\u0639\u0631\u0636 \u0633\u0627\u0631\u064D';
var pa = P(tA);
eq(roles(pa), ['call:num:1', 'note:num:1^'], 'arabe exposant unicode');
ok(pa[0].arabic === true, 'paragraphe arabe détecté');
eq(roles(P('\u0627\u0644\u0633\u0639\u0631\u0661 \u0647\u0646\u0627', [5])), ['call:num:1'], 'chiffre arabe-indien formaté en exposant');
var gl = A.analyzeGroup([frame('choisir (1) ou (2) puis * fin')], {});
eq([gl.calls.length, gl.issues.length], [0, 0], 'appels lâches sans mention ignorés (pas d’erreur)');
// 7. Mentions faibles « 1. »
var w1 = P('1. Pr\u00E9chauffer le four\r2. Enfourner');
eq(roles(w1), ['note:num:1?^', 'note:num:2?^'], 'liste numérotée = mentions faibles');
var rw = A.analyzeGroup([{ id: 0, box: [0, 1, 1, 0], text: '1. Pr\u00E9chauffer\r2. Enfourner', toks: w1 }], {});
eq([rw.notes.length, rw.issues.length], [0, 0], 'liste numérotée sans appel ignorée');
var w2 = frame('Offre\u00B9\r1. Valable en magasin.');
eq(A.analyzeGroup([w2], {}).issues.length, 0, 'mention faible reliée à un appel');
// 8. Virgule entre deux appels
var c2 = P('texte\u00B9,\u00B2 suite');
eq(roles(c2), ['call:num:1', 'call:num:2'], 'appels groupés');
ok(c2[0].punctAfter === -1 && c2[1].punctBefore === -1, 'virgule entre appels non signalée');
// 9. Diagnostic
var g9 = A.analyzeGroup([frame('Alpha\u00B9 Beta\u00B3 Gamma\u2074\r\u00B9 un\r\u2074 quatre\r\u2074 bis\r\u2075 cinq')], { punct: 'fr' });
eq(codes(g9), ['DUPNOTE', 'MISSING', 'ORDER', 'ORPHAN'], 'erreurs détectées');
ok(g9.maps.num['3'] === 2 && g9.maps.num['4'] === 3 && g9.maps.num['5'] === 4, 'plan de renumérotation');
// 10. Renumérotation + réordonnancement
var r10 = fix([frame('Bon\u00B3 puis Arc\u00B9\r\u00B9 note A\r\u00B3 note B')]);
eq(r10.texts[0], 'Bon\u00B9 puis Arc\u00B2\r\u00B9 note B\r\u00B2 note A', 'renumérotation et mentions remises dans l’ordre');
// 11. Ponctuation française
eq(fix([frame('Le prix.\u00B9 Suite\r\u00B9 x')]).texts[0], 'Le prix\u00B9. Suite\r\u00B9 x', 'FR : appel avant le point');
eq(fix([frame('Mention\u00B9\r\u00B9 x. Le prix.\u00B2'), frame('\u00B2 y', [0, -100, 100, -200])]).texts[0], 'Mention\u00B9\r\u00B9 x. Le prix\u00B2.', 'FR : fin de texte (mode B)');
eq(fix([frame('etc.\u00B9 suite\r\u00B9 x')]).texts[0], 'etc.\u00B9 suite\r\u00B9 x', 'point d’abréviation gardé');
eq(fix([frame('Le prix. *\r*Offre')]).texts[0], 'Le prix*.\r*Offre', 'FR : espace et point en fin de ligne');
eq(roles(P('Le prix. * suite')), ['note:sym:*'], 'après une fin de phrase : mention en ligne');
eq(fix([frame('price\u00B9, and\r\u00B9 x')], { punct: 'en' }).texts[0], 'price,\u00B9 and\r\u00B9 x', 'EN : appel après la virgule');
eq(fix([frame('price \u00B9, and\r\u00B9 x')], { punct: 'en' }).texts[0], 'price,\u00B9 and\r\u00B9 x', 'EN : espace et virgule');
eq(fix([frame('\u0627\u0644\u0633\u0639\u0631.\u00B9 \u0647\u0646\u0627\r\u00B9 \u0627\u0644\u0639\u0631\u0636')]).texts[0], '\u0627\u0644\u0633\u0639\u0631.\u00B9 \u0647\u0646\u0627\r\u00B9 \u0627\u0644\u0639\u0631\u0636', 'arabe : ponctuation non touchée');
// 12. Espace avant l'appel
eq(fix([frame('999 DA * seulement\r*Offre valable')]).texts[0], '999 DA* seulement\r*Offre valable', 'espace avant * supprimé');
eq(fix([frame('Prix TTC (2) et (1)\r(1) A\r(2) B')]).texts[0], 'Prix TTC(1) et(2)\r(1) B\r(2) A', 'parenthèses : espace, renumérotation, ordre');
// 13. Longueurs différentes (10 → 1)
var many = '', notes = '';
for (var k = 10; k >= 1; k--) { many += 'mot' + A.fmtNum(k, 'sup') + ' '; notes += '\r' + A.fmtNum(k, 'sup') + ' n' + k; }
var r13 = fix([frame(many + notes)]);
var exp13 = '', en13 = '';
for (k = 1; k <= 10; k++) { exp13 += 'mot' + A.fmtNum(k, 'sup') + ' '; en13 += '\r' + A.fmtNum(k, 'sup') + ' n' + (11 - k); }
eq(r13.texts[0], exp13 + en13, '10 appels inversés renumérotés');
// 14. Ordre de lecture multi-blocs, gauche→droite et droite→gauche
var fr = [{ box: [200, 100, 300, 80] }, { box: [0, 100, 100, 80] }, { box: [0, 50, 100, 30] }];
eq(A.readingOrder(fr, false), [1, 0, 2], 'ordre LTR');
eq(A.readingOrder(fr, true), [0, 1, 2], 'ordre RTL');
var g14 = A.analyzeGroup([{ id: 0, box: [200, 100, 300, 80], text: 'droite\u00B9', toks: P('droite\u00B9') }, { id: 1, box: [0, 100, 100, 80], text: 'gauche\u00B2', toks: P('gauche\u00B2') }, { id: 2, box: [0, 20, 300, 0], text: '\u00B9 a\r\u00B2 b', toks: P('\u00B9 a\r\u00B2 b') }], { rtl: 'ltr' });
ok(g14.maps.num['2'] === 1 && g14.maps.num['1'] === 2, 'LTR : bloc de gauche d’abord');
var g14b = A.analyzeGroup(g14.frames, { rtl: 'rtl' });
ok(!g14b.changed.num, 'RTL : bloc de droite d’abord (déjà dans l’ordre)');
// 15. Séquence des symboles
var g15 = A.analyzeGroup([frame('A\u2020 B*\r*x\r\u2020y')], {});
ok(g15.symSeq === A.SEQ_DAGGER && g15.maps.sym['\u2020'] === '*' && g15.maps.sym['*'] === '\u2020', 'séquence * † ‡');
eq(fix([frame('A** B*\r*x\r**y')]).texts[0], 'A* B**\r*y\r**x', 'astérisques renumérotés et triés');
// 16. Mentions manquantes
var g16 = A.analyzeGroup([frame('Alpha\u00B9 Beta\u00B2\r\u00B9 x')], {});
var pm = A.planMissing(g16, { renumber: true });
eq(pm.items.map(function (i) { return i.line; }), ['\u00B2 Mention \u00E0 compl\u00E9ter'], 'mention manquante prévue');
// 17. Réglages
var d = A.defaults(); d.units = 'm cm'; d.renumber = false;
var d2 = A.deserialize(A.serialize(d));
ok(d2.units === 'm cm' && d2.renumber === false && d2.punct === 'fr', 'réglages sérialisés');

// 18. Aléatoire : documents de notes mélangées, renumérotées puis vérifiées
function rnd(n) { return Math.floor(Math.random() * n); }
var fuzzOk = 0, FUZZ = 400;
for (var it = 0; it < FUZZ; it++) {
    var n = 1 + rnd(12), fam = ['sup', 'par', 'sym'][rnd(3)], ids = [], i, perm = [];
    for (i = 1; i <= n; i++) { ids.push(i); }
    ids.sort(function () { return Math.random() - 0.5; });
    function mk(v) { return fam === 'sup' ? A.fmtNum(v, 'sup') : fam === 'par' ? '(' + v + ')' : A.SEQ_STAR[v - 1] || '*'; }
    if (fam === 'sym') { n = Math.min(n, 5); ids = ids.filter(function (v) { return v <= 5; }); }
    var body = '', word = {}, extraRef = rnd(2);
    ids.forEach(function (v, j) { word[v] = 'mot' + j; body += 'mot' + j + mk(v) + ' et '; });
    if (extraRef && ids.length) { body += 'rappel' + mk(ids[0]) + ' '; }
    var order = ids.slice().sort(function () { return Math.random() - 0.5; });
    var nts = order.map(function (v) { return mk(v) + ' note de ' + word[v]; }).join('\r');
    var text = body + '\r' + nts;
    var out = fix([frame(text)]).texts[0];
    var toks = P(out), r = A.analyzeGroup([{ id: 0, box: [0, 1, 1, 0], text: out, toks: toks }], { punct: 'fr' });
    var bad = r.issues.filter(function (x) { return x.code !== 'SPACE'; });
    // chaque appel renvoie à la mention de son mot / each mark still points to its word's note
    var good = bad.length === 0;
    toks.forEach(function (t) {
        if (t.role !== 'call') { return; }
        var w = out.substring(0, t.s).match(/(mot\d+|rappel)$/);
        if (!w || w[1] === 'rappel') { return; }
        var nt = toks.filter(function (u) { return u.role === 'note' && u.key === t.key; })[0];
        if (!nt || out.substring(nt.e, nt.paraEnd).indexOf('note de ' + w[1]) < 0) { good = false; }
    });
    // numéros dans l'ordre / numbers in order
    var firsts = []; toks.forEach(function (t) { if (t.role === 'call' && firsts.indexOf(t.key) < 0) { firsts.push(t.key); } });
    firsts.forEach(function (k2, j) { var v = k2.split(':')[1]; if (fam !== 'sym' && Number(v) !== j + 1) { good = false; } if (fam === 'sym' && v !== A.SEQ_STAR[j]) { good = false; } });
    if (good) { fuzzOk++; } else if (fuzzOk + 5 > it) { console.log('fuzz KO', JSON.stringify(text), '=>', JSON.stringify(out), JSON.stringify(bad)); }
}
ok(fuzzOk === FUZZ, 'aléatoire ' + fuzzOk + '/' + FUZZ);
console.log('moteur pur / pure engine : ' + pass + ' OK, ' + fail + ' échec(s) ; aléatoire ' + fuzzOk + '/' + FUZZ);
process.exit(fail ? 1 : 0);
