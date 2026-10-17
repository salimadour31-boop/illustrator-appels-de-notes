// Tests de bout en bout sur DOM Illustrator simulé / end-to-end tests on a simulated Illustrator DOM
var M = require('./mock-ai');
var ctx = require('./load')(Object.assign({ app: { locale: 'fr_FR', redraw: function () { } } }, M.globals));
var A = ctx.ADN;
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL: ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' → ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); }
function opts(o) { return Object.assign(A.defaults(), o || {}); }
function ui(action, set) { var log = []; return { log: log, alert: function (s) { log.push(s); }, report: function (doc, an, lines, o) { log.push(lines.map(function (l) { return l.text; })); if (set) { Object.assign(o, set); } o.renumberNow = o.renumber; return action; } }; }
function supIdx(f) { var o = []; f.chars.forEach(function (x, i) { if (String(x.a.baselinePosition).indexOf('SUPERSCRIPT') >= 0) { o.push(i); } }); return o; }

// 1. Affiche : appels formatés en exposant, mentions dans un autre bloc, désordre
(function () {
    A.resetProbe(); M.OPT.BAD_DUP = false;
    var d = new M.Doc([[0, 800, 600, 0]]);
    var t1 = 'Prix 999 DA2 et livraison offerte1.';     // « 2 » et « 1 » mis en exposant / set as superscript
    var f1 = d.addText(t1, [20, 700, 400, 650], [11, 33]);
    var f2 = d.addText('Garantie 2 ans3', [20, 600, 400, 560], [14]);
    var f3 = d.addText('1 Livraison gratuite.\r2 Offre valable jusqu\u2019au 30/11.\r3 Pi\u00E8ces et main-d\u2019\u0153uvre.', [20, 60, 400, 10], [0, 22, 54]);
    var u = ui('fix');
    var r = A.run(d, opts(), u);
    eq(f1.contents, 'Prix 999 DA1 et livraison offerte2.', 'appels renumérotés (et ponctuation déjà correcte)');
    eq(supIdx(f1), [11, 33], 'exposants conservés');
    eq(f3.contents, '1 Offre valable jusqu\u2019au 30/11.\r2 Livraison gratuite.\r3 Pi\u00E8ces et main-d\u2019\u0153uvre.', 'mentions renumérotées et remises dans l’ordre');
    eq(supIdx(f3), [0, 32, 54], 'mise en forme des mentions copiée avec elles');
    ok(r.after.err === 0 && r.after.warn === 0, 'plus aucun problème après correction');
    ok(d.layers.filter(function (l) { return l.name === A.MARK_LAYER; }).length === 0, 'pas de calque de repères quand tout est bon');
})();

// 2. Ponctuation française, espace, mention manquante créée, repères
(function () {
    A.resetProbe();
    var d = new M.Doc([[0, 800, 600, 0], [700, 800, 1300, 0]]);
    var f1 = d.addText('Livraison offerte.\u00B9 Paiement en 3 fois *', [20, 700, 400, 650]);
    var f2 = d.addText('*Sans frais.\r\u00B9 En Alg\u00E9rie du Nord.', [20, 60, 400, 10]);
    var f3 = d.addText('Autre plan\u00B9', [720, 700, 1000, 650]);   // plan 2 : mention manquante / missing note
    var u = ui('fix', { createMissing: true });
    var r = A.run(d, opts(), u);
    eq(f1.contents, 'Livraison offerte\u00B9. Paiement en 3 fois*', 'appel avant le point, espace avant * supprimé');
    var created = d.textFrames.filter(function (f) { return /compl\u00E9ter/.test(f.contents); });
    ok(created.length === 1 && created[0].contents === '\u00B9 Mention \u00E0 compl\u00E9ter', 'mention manquante créée sur le plan 2');
    ok(created.length === 1 && created[0].box[0] > 700, 'mention créée sur le bon plan de travail');
    ok(r.after.err === 0, 'plus d’erreur après création');
    ok(u.log[0].some(function (l) { return /sans mention/.test(l); }), 'rapport : appel sans mention signalé');
})();

// 3. Repères seulement : rien n'est modifié
(function () {
    var d = new M.Doc();
    var f1 = d.addText('A savoir\u00B2 et\u00B9', [20, 700, 400, 650]);
    var f2 = d.addText('\u00B9 un\r\u00B2 deux\r\u00B3 trois', [20, 60, 400, 10]);
    var before = [f1.contents, f2.contents];
    var u = ui('marks');
    A.run(d, opts(), u);
    eq([f1.contents, f2.contents], before, 'repères seulement : textes intacts');
    var lay = d.layers.filter(function (l) { return l.name === A.MARK_LAYER; })[0];
    ok(lay && lay.printable === false && lay.items.length >= 2, 'calque de repères non imprimable');
    var u2 = ui('marks'); A.run(d, opts(), u2);
    ok(d.layers.filter(function (l) { return l.name === A.MARK_LAYER; }).length === 1, 'relance : un seul calque de repères');
})();

// 4. duplicate() différent : la vérification refuse de réordonner, rien n'est cassé
(function () {
    A.resetProbe(); M.OPT.BAD_DUP = true;
    var d = new M.Doc();
    var f1 = d.addText('Beta\u00B2 Alpha\u00B9', [20, 700, 400, 650]);
    var f2 = d.addText('\u00B9 note alpha\r\u00B2 note beta', [20, 60, 400, 10]);
    var u = ui('fix');
    var r = A.run(d, opts(), u);
    eq(f1.contents, 'Beta\u00B9 Alpha\u00B2', 'renumérotation faite');
    eq(f2.contents, '\u00B2 note alpha\r\u00B9 note beta', 'réordonnancement refusé proprement (contenu intact)');
    ok(r.stats.skipped >= 1 && r.stats.broken === 0, 'signalé comme ignoré, pas comme cassé');
    M.OPT.BAD_DUP = false; A.resetProbe();
})();

// 5. Bloc verrouillé, calque masqué, texte arabe droite → gauche
(function () {
    A.resetProbe();
    var d = new M.Doc();
    var hid = d.layers.add(); hid.visible = false;
    d.addText('Cach\u00E9\u00B9', [20, 500, 300, 480], null, hid);
    var fa = d.addText('\u0627\u0644\u062A\u0648\u0635\u064A\u0644\u00B2', [300, 700, 580, 650]);   // à droite / right
    var fb = d.addText('\u0627\u0644\u0633\u0639\u0631\u00B9', [20, 700, 280, 650]);                // à gauche / left
    var fn = d.addText('\u00B9 \u0627\u0644\u0633\u0639\u0631\r\u00B2 \u0627\u0644\u062A\u0648\u0635\u064A\u0644', [20, 60, 580, 10]);
    fn.locked = true;
    var u = ui('fix');
    var r = A.run(d, opts(), u);
    eq(fa.contents, '\u0627\u0644\u062A\u0648\u0635\u064A\u0644\u00B9', 'arabe : bloc de droite lu en premier');
    eq(fn.contents, '\u00B9 \u0627\u0644\u0633\u0639\u0631\r\u00B2 \u0627\u0644\u062A\u0648\u0635\u064A\u0644', 'bloc verrouillé non modifié');
    ok(r.stats.skipped >= 1, 'corrections du bloc verrouillé ignorées');
    ok(!u.log[0].some(function (l) { return /Cach/.test(l); }), 'calque masqué ignoré');
})();

// 6. Aucun appel / aucun document
(function () {
    var d = new M.Doc(); d.addText('Simple texte sans renvoi, 12 m\u00B2.', [0, 10, 10, 0]);
    var u = ui('fix'); var r = A.run(d, opts(), u);
    ok(r.action === 'none' && /Aucun appel/.test(u.log[0]), 'message quand il n’y a aucun appel');
    var d2 = new M.Doc(); var u2 = ui('fix'); A.run(d2, opts(), u2);
    ok(/Aucun texte/.test(u2.log[0]), 'message quand il n’y a aucun texte');
})();

// 7. Aléatoire : 150 documents de plusieurs blocs / random multi-frame documents
(function () {
    var good = 0, N = 150, it;
    for (it = 0; it < N; it++) {
        A.resetProbe();
        var d = new M.Doc(), n = 2 + Math.floor(Math.random() * 7), ids = [], i, words = {};
        for (i = 1; i <= n; i++) { ids.push(i); }
        ids.sort(function () { return Math.random() - 0.5; });
        var frames = [];
        ids.forEach(function (v, j) {
            var t = 'Bloc' + j + A.fmtNum(v, 'sup') + ' texte';
            words[v] = 'Bloc' + j;
            frames.push(d.addText(t, [20 + (j % 2) * 300, 700 - Math.floor(j / 2) * 60, 260 + (j % 2) * 300, 660 - Math.floor(j / 2) * 60]));
        });
        var order = ids.slice().sort(function () { return Math.random() - 0.5; });
        var fn = d.addText(order.map(function (v) { return A.fmtNum(v, 'sup') + ' note ' + words[v]; }).join('\r'), [20, 60, 580, 10]);
        var u = ui('fix'), r = A.run(d, opts(), u), okk = r.after.err === 0 && r.after.warn === 0;
        // chaque bloc j (ordre de lecture) porte le numéro j+1 et sa mention le cite
        frames.forEach(function (f, j) {
            var m = f.contents.match(/^(Bloc\d+)([\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+)/);
            if (!m || m[2] !== A.fmtNum(j + 1, 'sup')) { okk = false; return; }
            var line = fn.contents.split('\r')[j];
            if (line !== A.fmtNum(j + 1, 'sup') + ' note ' + m[1]) { okk = false; }
        });
        if (okk) { good++; }
    }
    ok(good === N, 'aléatoire DOM ' + good + '/' + N);
})();

console.log('DOM simulé / simulated DOM : ' + pass + ' OK, ' + fail + ' échec(s)');
process.exit(fail ? 1 : 0);
