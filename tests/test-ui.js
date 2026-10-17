// Fenêtres ScriptUI simulées : vérifie que les dialogues se construisent et renvoient les réglages.
// Simulated ScriptUI windows: checks the dialogs build and return settings.
var M = require('./mock-ai');
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL: ' + m); } }
var SCRIPT = null;
function Ctl(type, text) { this.type = type; this.text = text || ''; this.children = []; this.items = []; this.value = false; this.enabled = true; this.selection = null; }
Ctl.prototype.add = function (type, b, text, props) {
    var c = new Ctl(type, typeof text === 'string' ? text : '');
    if (type === 'dropdownlist' || type === 'listbox') { (text || []).forEach(function (t, i) { c.items.push({ text: t, index: i }); }); var self = c; Object.defineProperty(c, 'selection', { get: function () { return self._sel; }, set: function (v) { self._sel = typeof v === 'number' ? self.items[v] : v; } }); }
    if (type === 'item') { var it = { text: b === undefined ? text : b, index: this.items.length }; this.items.push(it); return it; }
    if (props && props.name) { c.name = props.name; }
    this.children.push(c); return c;
};
function find(w, pred) { var out = []; (function walk(c) { if (pred(c)) { out.push(c); } c.children.forEach(walk); })(w); return out; }
function Window(type, title) { Ctl.call(this, 'window', title); }
Window.prototype = Object.create(Ctl.prototype);
Window.prototype.show = function () { return SCRIPT(this); };
Window.prototype.close = function (v) { this.closed = v; };
var ctx = require('./load')(Object.assign({ app: { locale: 'fr_FR', redraw: function () { } }, Window: Window }, M.globals));
var A = ctx.ADN;

// Réglages : on choisit « Plan de travail actif », droite → gauche, ponctuation anglaise
SCRIPT = function (w) {
    var dds = find(w, function (c) { return c.type === 'dropdownlist'; });
    dds[0].selection = 1; dds[1].selection = 2; dds[2].selection = 2;
    var cbs = find(w, function (c) { return c.type === 'checkbox'; }); cbs[2].value = false;
    return 1;
};
var o = ctx.ADN.main ? null : null;
var d = new M.Doc(); d.addText('Mot\u00B2 et\u00B9\r\u00B9 a\r\u00B2 b', [0, 100, 100, 0]);
ctx.app.documents = [d]; ctx.app.activeDocument = d;
ctx.alert = function (s) { ctx.lastAlert = s; };
// main() complet : réglages puis rapport (on clique « Corriger »)
var step = 0;
SCRIPT = function (w) {
    step++;
    if (step === 1) {
        var dds = find(w, function (c) { return c.type === 'dropdownlist'; });
        ok(dds.length === 3, 'trois listes déroulantes dans les réglages');
        dds[0].selection = 2;
        return 1;
    }
    var lb = find(w, function (c) { return c.type === 'listbox'; })[0];
    ok(lb && lb.items.length === 1 && /ordre de lecture/.test(lb.items[0].text), 'rapport : liste des problèmes remplie (' + (lb && lb.items.length) + ')');
    var fixB = find(w, function (c) { return c.type === 'button' && /Corriger/.test(c.text); })[0];
    ok(!!fixB, 'bouton Corriger présent');
    fixB.onClick();
    return 1;
};
ctx.Folder = { userData: '/tmp' };
ctx.File = function () { this.exists = false; this.open = function () { }; this.write = function () { }; this.close = function () { }; };
ctx.ADN.main();
ok(step === 2, 'deux fenêtres affichées');
ok(d.textFrames[0].contents === 'Mot\u00B9 et\u00B2\r\u00B9 b\r\u00B2 a', 'corrections appliquées depuis les fenêtres : ' + JSON.stringify(d.textFrames[0].contents));
ok(/Corrections faites/.test(ctx.lastAlert || ''), 'message de fin');
// Aucun document
ctx.app.documents = []; ctx.lastAlert = '';
ctx.ADN.main();
ok(/Aucun document/.test(ctx.lastAlert), 'message sans document');
console.log('fenêtres simulées / simulated dialogs : ' + pass + ' OK, ' + fail + ' échec(s)');
process.exit(fail ? 1 : 0);
