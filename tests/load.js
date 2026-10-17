// Charge AppelsDeNotes.jsx dans Node sans lancer main() / loads the script without running main()
var fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load(globals) {
    var src = fs.readFileSync(process.env.ADN_SRC || path.join(__dirname, '..', 'AppelsDeNotes.jsx'), 'utf8').replace(/^\uFEFF/, '');
    var ctx = Object.assign({ ADN_NO_AUTORUN: true, Math: Math, String: String, Number: Number, parseFloat: parseFloat, isNaN: isNaN, Infinity: Infinity, Error: Error }, globals || {});
    if (!ctx.app) { ctx.app = { locale: 'fr_FR' }; }
    vm.createContext(ctx);
    vm.runInContext(src + '\n;this.ADN = ADN;', ctx, { filename: 'AppelsDeNotes.jsx' });
    return ctx;
};
