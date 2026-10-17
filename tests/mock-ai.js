// DOM Illustrator simulé (minimal) pour tester AppelsDeNotes.jsx de bout en bout.
// Minimal simulated Illustrator DOM: text frames made of characters with attributes (superscript,
// size, colour), characters / insertionPoints / paragraphs collections, paragraph duplicate,
// layers, artboards, rectangles. Option BAD_DUP simulates a different duplicate() behaviour.
var OPT = { BAD_DUP: false };
var FontBaselineOption = { NORMALBASELINE: 'FontBaselineOption.NORMALBASELINE', SUPERSCRIPT: 'FontBaselineOption.SUPERSCRIPT', SUBSCRIPT: 'FontBaselineOption.SUBSCRIPT' };
var ElementPlacement = { PLACEBEFORE: 'PLACEBEFORE', PLACEAFTER: 'PLACEAFTER' };
var ParagraphDirectionType = { RIGHT_TO_LEFT_DIRECTION: 'RTL', LEFT_TO_RIGHT_DIRECTION: 'LTR' };
function CMYKColor() { this.typename = 'CMYKColor'; }
function RGBColor() { this.typename = 'RGBColor'; }

function attrs(o) { return Object.assign({ baselinePosition: FontBaselineOption.NORMALBASELINE, openTypePosition: 'FontOpenTypePositionOption.OPENTYPEDEFAULT', baselineShift: 0, size: 12, fill: 'black' }, o || {}); }
function cloneA(a) { return Object.assign({}, a); }

function Frame(layer, text, box, supIdx) {
    var self = this;
    this.typename = 'TextFrame'; this.parent = layer; this.hidden = false; this.locked = false; this.name = ''; this.selected = false;
    this.box = box || [0, 100, 200, 0];
    this.chars = [];
    for (var i = 0; i < text.length; i++) { this.chars.push({ c: text.charAt(i), a: attrs(supIdx && supIdx.indexOf(i) >= 0 ? { baselinePosition: FontBaselineOption.SUPERSCRIPT } : {}) }); }
    this.paraAttrs = {};
    Object.defineProperty(this, 'textRange', { get: function () { return makeRange(self, 0, self.chars.length); } });
}
Object.defineProperty(Frame.prototype, 'contents', {
    get: function () { return this.chars.map(function (x) { return x.c; }).join(''); },
    set: function (v) { var a = this.chars.length ? cloneA(this.chars[0].a) : attrs(); this.chars = String(v).split('').map(function (c) { return { c: c, a: cloneA(a) }; }); }
});
Object.defineProperty(Frame.prototype, 'geometricBounds', { get: function () { return this.box.slice(); } });
Object.defineProperty(Frame.prototype, 'position', { get: function () { return [this.box[0], this.box[1]]; }, set: function (p) { var w = this.box[2] - this.box[0], h = this.box[1] - this.box[3]; this.box = [p[0], p[1], p[0] + w, p[1] - h]; } });
Object.defineProperty(Frame.prototype, 'characters', { get: function () {
    var f = this, arr = f.chars.map(function (x, i) { return makeChar(f, i); });
    return arr;
} });
Object.defineProperty(Frame.prototype, 'insertionPoints', { get: function () {
    var f = this, arr = [];
    for (var i = 0; i <= f.chars.length; i++) { arr.push(makeIP(f, i)); }
    return arr;
} });
Object.defineProperty(Frame.prototype, 'paragraphs', { get: function () {
    var f = this, out = [], s = 0, t = f.contents, i;
    for (i = 0; i <= t.length; i++) { if (i === t.length || t.charAt(i) === '\r') { out.push(makePara(f, s, i)); s = i + 1; } }
    return out;
} });
Frame.prototype.remove = function () { var l = this.parent; l.items.splice(l.items.indexOf(this), 1); this.removed = true; };

function attrProxy(f, s, e) {
    var keys = ['baselinePosition', 'openTypePosition', 'baselineShift', 'size'], o = {};
    keys.forEach(function (k) {
        Object.defineProperty(o, k, { get: function () { return f.chars[s] ? f.chars[s].a[k] : undefined; }, set: function (v) { for (var i = s; i < e; i++) { f.chars[i].a[k] = v; } } });
    });
    Object.defineProperty(o, 'fillColor', { get: function () { return f.chars[s] && f.chars[s].a.fill; }, set: function (v) { for (var i = s; i < e; i++) { f.chars[i].a.fill = v; } } });
    return o;
}
function makeRange(f, s, e) {
    return { characterAttributes: attrProxy(f, s, e), paragraphAttributes: f.paraAttrs, get contents() { return f.contents.substring(s, e); } };
}
function makeChar(f, i) {
    return {
        get contents() { return f.chars[i].c; },
        set contents(v) {
            var a = f.chars[i].a, ins = String(v).split('').map(function (c) { return { c: c, a: cloneA(a) }; });
            f.chars.splice.apply(f.chars, [i, 1].concat(ins));
        },
        remove: function () { if (f.locked) { throw new Error('locked'); } f.chars.splice(i, 1); },
        characterAttributes: attrProxy(f, i, i + 1)
    };
}
function makeIP(f, i) {
    return { _f: f, _i: i, characters: { add: function (str) {
        var src = f.chars[i - 1] || f.chars[i], a = src ? cloneA(src.a) : attrs();
        var ins = String(str).split('').map(function (c) { return { c: c, a: cloneA(a) }; });
        f.chars.splice.apply(f.chars, [i, 0].concat(ins));
    } } };
}
function makePara(f, s, e) {
    return {
        get contents() { return f.contents.substring(s, e); },
        duplicate: function (ip, where) {
            var copy = f.chars.slice(s, e).map(function (x) { return { c: x.c, a: cloneA(x.a) }; });
            var at = OPT.BAD_DUP ? ip._f.chars.length : ip._i;   // BAD_DUP : copie en fin de bloc / copies at the end
            ip._f.chars.splice.apply(ip._f.chars, [at, 0].concat(copy));
            return makeRange(ip._f, at, at + copy.length);
        }
    };
}

function Layer(doc, name) {
    var self = this;
    this.typename = 'Layer'; this.parent = doc; this.name = name || 'Calque'; this.visible = true; this.locked = false; this.printable = true; this.items = []; this.hidden = false;
    this.textFrames = { add: function () { var f = new Frame(self, '', [0, 10, 50, 0]); self.items.push(f); return f; } };
    this.pathItems = { rectangle: function (top, left, w, h) { var r = { typename: 'PathItem', box: [left, top, left + w, top - h] }; self.items.push(r); return r; } };
}
Layer.prototype.remove = function () { var d = this.parent; d.layers.splice(d.layers.indexOf(this), 1); };

function Doc(abRects) {
    var self = this;
    this.typename = 'Document'; this.documentColorSpace = 'DocumentColorSpace.CMYK'; this.selection = null;
    this.layers = [new Layer(this, 'Calque 1')];
    this.layers.add = function () { var l = new Layer(self, 'Calque ' + (self.layers.length + 1)); self.layers.unshift(l); return l; };
    this.activeLayer = this.layers[0];
    this.artboards = (abRects || [[0, 800, 600, 0]]).map(function (r, i) { return { artboardRect: r, name: 'P' + (i + 1) }; });
    this.artboards.getActiveArtboardIndex = function () { return self.activeAB || 0; };
    Object.defineProperty(this, 'textFrames', { get: function () {
        var out = [];
        self.layers.forEach(function (l) { l.items.forEach(function (it) { if (it.typename === 'TextFrame') { out.push(it); } }); });
        out.add = function () { return self.activeLayer.textFrames.add(); };
        return out;
    } });
}
Doc.prototype.addText = function (text, box, sup, layer) { var l = layer || this.layers[this.layers.length - 1]; var f = new Frame(l, text, box, sup); l.items.push(f); return f; };

module.exports = { OPT: OPT, Doc: Doc, Frame: Frame, globals: { FontBaselineOption: FontBaselineOption, ElementPlacement: ElementPlacement, ParagraphDirectionType: ParagraphDirectionType, CMYKColor: CMYKColor, RGBColor: RGBColor } };
