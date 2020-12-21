export function lastOnly(path, functionId, toKey) {
    var lastOnes = new Map();
    path.forEach(function (p) {
        if (p.f_id === functionId) {
            lastOnes.set(toKey(p), p);
        }
    });
    return path.filter(function (p) {
        if (p.f_id !== functionId) {
            return true;
        }
        var key = toKey(p);
        //last one remains
        return lastOnes.get(key) === p;
    });
}
export function createRemove(path, createFunctionId, removeFunctionId) {
    var r = [];
    outer: for (var _i = 0, path_1 = path; _i < path_1.length; _i++) {
        var act = path_1[_i];
        if (act.f_id === removeFunctionId) {
            var removed = act.removes[0];
            //removed view delete intermediate change and optional creation
            for (var j = r.length - 1; j >= 0; --j) {
                var previous = r[j];
                var requires = previous.requires;
                var usesView = requires.indexOf(removed) >= 0;
                if (usesView) {
                    r.splice(j, 1);
                }
                else if (previous.f_id === createFunctionId && previous.creates[0] === removed) {
                    //found adding remove both
                    r.splice(j, 1);
                    continue outer;
                }
            }
        }
        r.push(act);
    }
    return r;
}
//# sourceMappingURL=compress.js.map
//# sourceMappingURL=compress.js.map