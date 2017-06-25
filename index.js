var postcss = require('postcss');
var shortid = require('shortid');

var CSS_CUSTOM_PROP_RE = /^\s*(--[^:\s]+)/;
var CSS_VAR_RE = /^\s*var\(\s*([^,\)\s]+)(.*?)\)/;

function path(node) {
    var res = [node];
    while ((node = node.parent, node.type !== 'root')) {
        res = [node].concat(res);
    }
    return res;
}

function createCleanClone(nodePath) {
    var res = Array(nodePath.length);
    res[0] = nodePath[0].clone();

    for (var i = 1, l = nodePath.length; i < l; i++) {
        res[i - 1].each(function (node) {
            if (node.source === nodePath[i].source) {
                res[i] = node;
            } else {
                node.remove();
            }
        });
    }

    res[res.length - 1].removeAll();

    return res;
}

function hash(node) {
    return node.source.input.id + ',' + node.source.start.line + ',' + node.source.end.line + ',' + node.source.start.column + ',' + node.source.end.column;
}

function ensure(v, o) {
    return v ? v : o;
}

function cleanup(node) {
    if (node.type === 'root') {
        return;
    }
    var parent = node.parent;
    node.remove();
    if (parent.nodes.length == 0) {
        cleanup(parent);
    }
}

function linSelector(node) {
    return path(node).map(node => node.selector).join(' ');
}

module.exports = postcss.plugin('postcss-scoped-vars', function (opts) {
    opts = opts || {};
    opts.generate = 'generate' in opts ? opts.generate : shortid.generate;

    return function (root, result) {        
        var idx;

        var use = {};
        var useByNode = {};
        var dec = {};
        var decByNode = {};        

        idx = 0;        
        root.walkDecls(function (decl) {                  
            var match;
            // find all custom property declarations that are not in the root scope
            if ((match = CSS_CUSTOM_PROP_RE.exec(decl.prop)) && decl.parent.selector !== ':root') {
                var decNodeId = hash(decl.parent);                
                var propName = match[1];                   
                dec[propName] = ensure(dec[propName], []);
                dec[propName].push(decNodeId);                                                
                decByNode[decNodeId] = ensure(decByNode[decNodeId], { node: decl.parent, idx: idx, props: {}, remap: {}, clone: void 0 });
                decByNode[decNodeId].props[propName] = ensure(decByNode[decNodeId].props[propName], {});
                decByNode[decNodeId].props[propName] = decl;
            }
            idx++;
        });    

        idx = 0;
        root.walkDecls(function (decl) {
            var match;
            // find all var(...) expressions that use a variable that is declared in a non-root scope
            if ((match = CSS_VAR_RE.exec(decl.value))) {                
                var useNodeId = hash(decl.parent);                
                var propName = match[1];                
                if (dec[propName]) {                    
                    use[propName] = ensure(use[propName], []);
                    use[propName].push(useNodeId);                       
                    useByNode[useNodeId] = ensure(useByNode[useNodeId], { node: decl.parent, idx: idx, props: {} });
                    useByNode[useNodeId].props[propName] = ensure(useByNode[useNodeId].props[propName], []);   
                    useByNode[useNodeId].props[propName].push({ decl: decl, match: match});                                                
                }
            }
            idx++;
        });         

        var remapDecRule = postcss.rule({ selector: ':root' });        

        // for all declarations in a custom scope, we create a :root scoped declaration, with the same value and a unique name
        for (var nodeId in decByNode) {
            var tag = opts.generate();

            for (var usePropName in decByNode[nodeId].props) {
                // original non-scoped declaration
                var prevDec = decByNode[nodeId].props[usePropName];
                // unique root scoped declaration
                var nextDec = prevDec.clone({ prop: prevDec.prop + '-' + tag, raws: { between: ': ' }});
                
                remapDecRule.append(nextDec);
                
                // track the new prop name vs. the old prop name
                decByNode[nodeId].remap[prevDec.prop] = nextDec.prop;
            }
            
            decByNode[nodeId].clone = createCleanClone(path(decByNode[nodeId].node));
        }

        root.prepend(remapDecRule);

        // go through each rule where a custom prop was consumed
        for (var useNodeId in useByNode) {
            // do not consume the same declaration rule twice
            var consumed = {};        
            // go though each custom prop that was consumed
            for (var usePropName in useByNode[useNodeId].props) {
                // go through each rule in which a custom prop with the correct name was declared
                for (var i = 0, l = dec[usePropName].length; i < l; i++) {
                    // track the rule id
                    var decNodeId = dec[usePropName][i];
                    // do not consume the same declaration rule twice
                    if (consumed[decNodeId]) {
                        continue;
                    }
                    consumed[decNodeId] = true;
                    // if the rule consuming the custom prop is not the same as where it was declared
                    if (useNodeId !== decNodeId) {
                        // create a clone of the rules that define the scope where the declaration took place
                        var decScope = createCleanClone(decByNode[decNodeId].clone);
                        // place this after the rule where the property was consumed
                        useByNode[useNodeId].node.after(decScope[0]);
                        // clone the consuming scope and update the selector
                        // todo: this should be a clone path
                        var useScope = useByNode[useNodeId].node.clone({ 
                            selector: '& ' + useByNode[useNodeId].node.selector,
                            raws: { } 
                        });
                        // empty the use scope so we only contain the remapped custom prop uses
                        useScope.removeAll();
                        // go over each prop name that was declared by the declaring rule
                        for (var decPropName in decByNode[decNodeId].props) {
                            // put every prop in the declaring rule that is also in the consuming rule in the set
                            if (useByNode[useNodeId].props[decPropName]) {  
                                for (var j = 0, m = useByNode[useNodeId].props[decPropName].length; j < m; j++) {
                                    var currentUse = useByNode[useNodeId].props[decPropName][j];
                                    useScope.append(postcss.decl({
                                        prop: currentUse.decl.prop,
                                        value: currentUse.match[2] 
                                            ? 'var(' + decByNode[decNodeId].remap[decPropName] + currentUse.match[2]
                                            : 'var(' + decByNode[decNodeId].remap[decPropName] + ')'
                                    }));
                                }                                
                            }
                        }
                        
                        decScope[decScope.length - 1].append(useScope);             
                    } else {
                        var useScope = useByNode[useNodeId].node;
                        for (var decPropName in decByNode[decNodeId].props) {
                            if (useByNode[useNodeId].props[decPropName]) {
                                for (var j = 0, m = useByNode[useNodeId].props[decPropName].length; j < m; j++) {
                                    var currentUse = useByNode[useNodeId].props[decPropName][j];
                                    useScope.append(postcss.decl({
                                        prop: currentUse.decl.prop,
                                        value: currentUse.match[2]
                                            ? 'var(' + decByNode[decNodeId].remap[decPropName] + currentUse.match[2]
                                            : 'var(' + decByNode[decNodeId].remap[decPropName] + ')'
                                    }));
                                    currentUse.decl.remove();
                                }
                            }
                        }
                    }
                }
            }
        }

        for (var nodeId in decByNode) {
            for (var usePropName in decByNode[nodeId].props) {
                cleanup(decByNode[nodeId].props[usePropName]);                
            }
        }
    };
});
 