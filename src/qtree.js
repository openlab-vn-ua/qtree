// JavaScript quick tree view control
// Open Source Software under MIT License

// Main tree render function
// Use qTree(domNode, rootChildren, options)
// where 
//  domNode - target node to insject tree into(old content cleared, unless other spesified in options)
//  rootChildren - array of root tree nodes (use [ rootNode ] if you have only one root) AKA level 0 nodes
//  parameters - options object with flags that control how to render the tree
// treeNode object should contain:
//  string html        : html to show inside the node
//  string text        : text to show for the node (used in case html property is not present)
//  string id          : id that will be used to reffer node [optional]
//  array  children    : array of children nodes [optional]
//  object userData    : any data that seems reasonable to attach as properties of tree LI objects
//  bool   hasCheckbox : true/false about do the node has checkbox [optional] (if absent or null, options.hasCheckboxes used)
//  string className   : css class name to add to the node [optional]
// Note:
//  After render is done, tree may operate as pure HTML strcuture, the source data may be disposed
// Optional render handlers
//  parameters.funcGetTreeNode(userNode, treeContext) can be defined as 'transform' function to return treeNode by userNode (if null returned, node not rendered)
//  After node is rendered
//  parameters.funcAttachDomNode(userNode, domNode, treeContext) optionaly called to attach created domNode to userNode
function qTree(treeContainer, rootChildren, parameters) {

    var me = qTree; // link to myself (for constants publishing)

    // All work is done via DOM nodes, source tree data strcuture used as read-only data source

    if (parameters == null) { parameters = {}; }

    // options
    // ----------------------------------

    var needClearTarget = true;
    if (parameters.needClearTarget != null) { needClearTarget = parameters.needClearTarget; }

    var attachSourceNode = false;
    if (parameters.attachSourceNode != null) { attachSourceNode = parameters.attachSourceNode; }

    var hasCheckboxes = false;
    if (parameters.hasCheckboxes != null) { hasCheckboxes = parameters.hasCheckboxes; }

    var expandLevels = 0;
    if (parameters.expandLevels != null) { expandLevels = parameters.expandLevels; }
    if (expandLevels < 0) { expandLevels = 0; }

    var funcGetTreeNode = function (userNode, treeContext) { return userNode; };
    if (parameters.funcGetTreeNode != null) { funcGetTreeNode = parameters.funcGetTreeNode; }

    var funcAttachDomNode = function (userNode, domNode, treeContext) { };
    if (parameters.funcAttachDomNode != null) { funcAttachDomNode = parameters.funcAttachDomNode; }

    var funcIsNodeExpanded = function (userNode, treeContext) { return false; }
    if (parameters.funcIsNodeExpanded != null) { funcIsNodeExpanded = parameters.funcIsNodeExpanded; }

    var useStyleDisplayForShowAndHide = true;
    if (parameters.useStyleDisplayForShowAndHide != null) { useStyleDisplayForShowAndHide = parameters.useStyleDisplayForShowAndHide; }

    var isCheckedPropagated = true;
    if (parameters.isCheckedPropagated != null) { isCheckedPropagated = parameters.isCheckedPropagated; }

    var handlers = { };

    handlers.onNodeToggled = function (treeEvent) { };
    if (parameters.onNodeToggled != null) { handlers.onNodeToggled = parameters.onNodeToggled; }

    handlers.onNodeChecked = function (treeEvent) { };
    if (parameters.onNodeChecked != null) { handlers.onNodeChecked = parameters.onNodeChecked; }

    var isSelectable = false;
    if (parameters.isSelectable != null) { isSelectable = parameters.isSelectable; }

    handlers.onNodeSelected = function (treeEvent) { };
    if (parameters.onNodeSelected != null) { handlers.onNodeSelected = parameters.onNodeSelected; }

    var selectedClassName = 'qtree-selected';
    if (parameters.selectedClassName != null) { selectedClassName = parameters.selectedClassName; }

    // utils
    // ----------------------------------

    function isRenderAsExpanded(userNode, treeContext) {
        if (treeContext.level < expandLevels) { return true; }
        return funcIsNodeExpanded(userNode, treeContext);
    }

    var IDETERMINATE_BY_CLASS = false;

    function isCheckboxIndeterminate(cb) {
        if (IDETERMINATE_BY_CLASS) {
            return cb.classList.contains('qtree-checkbox-indeterminate');
        }
        return cb.indeterminate;
    }

    function setCheckboxChecked(cb, checked) {
        if (cb.checked == checked) { return; } // skip change if aready ok [optimisation]
        cb.checked = checked;
    }

    function setCheckboxIndeterminate(cb, indeterminate) {
        if (isCheckboxIndeterminate(cb) == indeterminate) { return; } // skip change if aready ok [optimisation]
        if (IDETERMINATE_BY_CLASS) {
            if (indeterminate) {
                cb.classList.add('qtree-checkbox-indeterminate');
            } else {
                cb.classList.remove('qtree-checkbox-indeterminate');
            }
        } else {
            cb.indeterminate = indeterminate;
        }
    }

    function escapeCSSAttrValue(s) {
        return s
            .replace('\\', '\\\\')
            .replace('\'', '\\\'')
            .replace('\"', '\\\"');
    }

    function stopEventPropagation(e) {
        if (e.stopPropagation != null) {
            e.stopPropagation();
        } else {
            e.cancelBubble = true;
        }
    }

    // Tree dom strcuture
    // ----------------------------------
    // LI -> TreeItemDomNode
    //  DIV -> TreeLineDomSubNode
    //   INPUT.CHECKBOX  -> TreeCheckboxDomSubSubNode (opt)
    //   SPAN  -> TreeTextDomSubSubNode
    //  UL -> TreeChildrenBagDomSubNode (opt)

    function getTreeRootDomNode() {
        return treeContainer;
    }

    var QTREE_NODE_ID_ATTR = 'qtree-node-id';

    function makeTreeNodeLineDomSubNode() {
        var domNode = document.createElement('div');
        domNode.className = 'qtree qtree-line';
        if (isSelectable) {
            domNode.onclick = onLineNodeClick;
        }
        return domNode;
    }

    function makeTreeNodeTextDomSubSubNode(html, text) {
        var domNode = document.createElement('span');
        domNode.className = 'qtree qtree-text';
        if ((html != null) && (html != '')) {
            domNode.innerHTML = html;
        } else {
            domNode.innerText = text;
        }
        return domNode;
    }

    function makeTreeNodeCheckboxDomSubSubNode() {
        var domNode = document.createElement('input');
        domNode.setAttribute('type', 'checkbox');
        domNode.className = 'qtree qtree-checkbox';
        domNode.onclick = onCheckboxNodeClick;
        return domNode;
    }

    function makeTreeNodeChindrenBagDomSubNode(level) {
        var domNode = document.createElement('ul');
        domNode.className = 'qtree qtree-list';
        domNode.onclick = stopEventPropagation;
        return domNode;
    }

    function getTreeItemDomNode(domNodeOrSubNode) {
        var domNode = domNodeOrSubNode;
        if (domNode == null) { return null; }
        if (domNode.qTreeNode != null) { return domNode; } // LI
        if (domNode.parentElement == null) { return null; }
        if (domNode.parentElement.qTreeNode != null) { return domNode.parentElement; } // DIV | UL
        if (domNode.parentElement.parentElement == null) { return null; }
        if (domNode.parentElement.parentElement.qTreeNode != null) { return domNode.parentElement.parentElement; } // INPUT/SPAN
        return null;
    }

    function getTreeParentItemDomNode(domNode) {
        if (domNode == null) { return null; }
        domNode = getTreeItemDomNode(domNode);
        if (domNode == null) { return null; }
        if (domNode.parentElement == null) { return null; } // UL
        if (domNode.parentElement.parentElement == null) { return null; } // LI
        if (domNode.parentElement.parentElement.qTreeNode == null) { return null; }
        if (domNode.parentElement.parentElement.qTreeNode.isMegaRoot) { return null; } 
        return domNode.parentElement.parentElement;
    }

    function getTreeCheckboxDomSubSubNode(domNode) {
        var NONE = null; // empty
        if (domNode == null) { return NONE; }
        domNode = getTreeItemDomNode(domNode);
        if (domNode == null) { return NONE; }
        if (domNode.children.length <= 0) { return NONE; }
        var line = domNode.children[0]; // DIV
        // first input inside LI DIV will hold checkbox
        var cl = line.children;
        if (cl.length <= 0) { return NONE; }
        if (cl[0].tagName == 'INPUT') { return cl[0]; }
        return NONE;
    }

    function getTreeChildrenNodeBagDomSubNode(domNode) {
        var NONE = null; // empty
        if (domNode == null) { return NONE; }
        domNode = getTreeItemDomNode(domNode);
        if (domNode == null) { return NONE; }
        // last UL inside LI hold dom children
        var cl = domNode.children;
        if (cl.length <= 0) { return NONE; }
        if (cl[cl.length - 1].tagName == 'UL') { return cl[cl.length - 1]; }
        return NONE;
    }

    function getTreeChildrenDomNodesList(domNode) {
        var NONE = []; // empty
        if (domNode == null) { return NONE; }
        domNode = getTreeChildrenNodeBagDomSubNode(domNode);
        if (domNode == null) { return NONE; }
        return domNode.children;
    }

    function addTreeCheckboxToItemDomNode(domNode) {
        var NONE = null; // fail
        if (domNode == null) { return NONE; }
        domNode = getTreeItemDomNode(domNode);
        if (domNode == null) { return NONE; }
        var cb = getTreeCheckboxDomSubSubNode(domNode);
        if (cb != null) { return cb; }
        if (domNode.children.length <= 0) { return NONE; }
        var line = domNode.children[0]; // DIV;
        cb = makeTreeNodeCheckboxDomSubSubNode();
        if (line.children.length <= 0) { line.appendChild(cb); return cb; }
        line.insertBefore(cb, line.children[0]);
        return cb;
    }

    function delTreeCheckboxFromItemDomNode(domNode) {
        var NONE = null; // fail
        if (domNode == null) { return NONE; }
        domNode = getTreeItemDomNode(domNode);
        if (domNode == null) { return NONE; }
        var cb = getTreeCheckboxDomSubSubNode(domNode);
        if (cb == null) { return NONE; }
        cb.parentNode.removeNode(cb);
        return cb;
    }

    function makeTreeItemDomNode(userNode, level) {
        if (userNode == null) { return null; } // bugrap

        var treeContext = { level: level };

        var treeNode = funcGetTreeNode(userNode, treeContext);
        if (treeNode == null) { return null; } // do not render
        var domNode = document.createElement('li');
        funcAttachDomNode(userNode, domNode, treeContext);

        var qTreeData = { level: level };

        if (attachSourceNode) {
            if (attachSourceNode) {
                qTreeData.sourceNode = treeNode;
            }
        }

        if (treeNode.userData != null) {
            qTreeData.userData = treeNode.userData;
        }

        domNode.qTreeNode = qTreeData;

        var className = 'qtree qtree-node';

        className += ' ' + 'qtree-level-' + level;

        domNode.onclick = onTreeNodeListItemDomNodeClick;

        if (treeNode.id != null) {
            domNode.setAttribute(QTREE_NODE_ID_ATTR, treeNode.id);
        }

        var line = makeTreeNodeLineDomSubNode();

        var hasCheckbox = false;

        if (treeNode.hasCheckbox != null) {
            hasCheckbox = treeNode.hasCheckbox;
        } else {
            hasCheckbox = hasCheckboxes;
        }

        if (hasCheckbox) {
            line.appendChild(makeTreeNodeCheckboxDomSubSubNode());
        }

        line.appendChild(makeTreeNodeTextDomSubSubNode(treeNode.html || '', treeNode.text || ''));

        domNode.appendChild(line);

        // Children

        var hasChildren = (treeNode.children != null) && (treeNode.children.length > 0); // draft

        var bag = null; // UL

        if (hasChildren) {
            // looks like we have a children, but we will know for sue after we draw them
            bag = makeTreeNodeChindrenBagDomSubNode(level + 1);
            var treeChildren = treeNode.children;
            var realChildrenCount = 0;
            var childDomNode;

            for (var i = 0; i < treeChildren.length; i++) {
                childDomNode = makeTreeItemDomNode(treeChildren[i], level + 1);
                if (childDomNode != null) {
                    bag.appendChild(childDomNode);
                    realChildrenCount++;
                }
            }

            if (realChildrenCount <= 0) {
                // actualy, we do not have a children or they are not rendered
                hasChildren = false; 
                bag = null;
            }
        }

        if ((bag != null) && (hasChildren)) {
            domNode.appendChild(bag);
        }

        if (hasChildren) {
            className += ' ' + 'qtree-node-with-children';
        }
        else {
            className += ' ' + 'qtree-node-without-children';
        }

        if (hasChildren) {
            var isExpanded = isRenderAsExpanded(userNode, treeContext);
            if (isExpanded) {
                className += ' ' + 'qtree-subtree-open';
                if (bag != null) { bag.style.display = ''; }
            }
            else {
                className += ' ' + 'qtree-subtree-collapsed';
                if (bag != null) { bag.style.display = 'none'; }
            }
        }

        if ((treeNode.className != null) && (treeNode.className != '')) {
            className += ' ' + treeNode.className;
        }

        domNode.className = className;

        return domNode;
    }

    // Events
    // -------------------------------

    // Expand/Collapse

    function hideTreeNodeChildrenList(domNode) {
        var li = getTreeItemDomNode(domNode);
        if (li == null) { return; }
        if (useStyleDisplayForShowAndHide) {
            var ul = getTreeChildrenNodeBagDomSubNode(li);
            if (ul != null) { ul.style.display = 'none'; }
        }

        if (li.classList.contains('qtree-subtree-open')) {
            li.classList.remove('qtree-subtree-open');
            li.classList.add('qtree-subtree-collapsed');
        }
    }

    function showTreeNodeChildrenList(domNode) {
        var li = getTreeItemDomNode(domNode);
        if (li == null) { return; }
        if (useStyleDisplayForShowAndHide) {
            var ul = getTreeChildrenNodeBagDomSubNode(li);
            if (ul != null) { ul.style.display = ''; }
        }

        if (li.classList.contains('qtree-subtree-collapsed')) {
            li.classList.remove('qtree-subtree-collapsed');
            li.classList.add('qtree-subtree-open');
        }
    }

    function isTreeNodeChildrenListVisible(domNode) {
        var li = getTreeItemDomNode(domNode);
        if (li == null) { return false; }
        return li.classList.contains('qtree-subtree-open');
    }

    function isTreeNodeChildrenListPresent(domNode) {
        var childs = getTreeChildrenDomNodesList(domNode);
        return ((childs != null) && (childs.length > 0));
    }

    var dispatchOnNodeToggled = function (treeEvent) { handlers.onNodeToggled(treeEvent); };

    function onTreeNodeListItemDomNodeClick(e) {
        stopEventPropagation(e);
        var domNode = e.currentTarget; // li
        if (!isTreeNodeChildrenListPresent(domNode)) { return; } // No children
        if (isTreeNodeChildrenListVisible(domNode)) {
            hideTreeNodeChildrenList(domNode);
            dispatchOnNodeToggled({ domNode: domNode, isOpen: false });
        }
        else {
            showTreeNodeChildrenList(domNode);
            dispatchOnNodeToggled({ domNode: domNode, isOpen: true });
        }
    }

    // Checked

    var PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX = true;

    function isAllChildrenNodesCheckedStateMatch(domNode, checked) {
        // check all children
        var childs = getTreeChildrenDomNodesList(domNode);
        if ((childs == null) || (childs.length <= 0)) { return true; }
        var ccb;
        for (var i = 0; i < childs.length; i++) {
            ccb = getTreeCheckboxDomSubSubNode(childs[i]);
            if (ccb != null) {
                if ((checked == null) && isCheckboxIndeterminate(ccb)) {
                    // Ok, match
                } else if (ccb.checked == checked) {
                    // Ok, match
                } else {
                    return false;
                }
            }
        }
        return true;
    }

    function setChildrenNodesChecked(domNode, checked) {
        // check all children
        var childs = getTreeChildrenDomNodesList(domNode);
        if ((childs == null) || (childs.length <= 0)) { return; }
        var ccb;
        for (var i = 0; i < childs.length; i++) {
            ccb = getTreeCheckboxDomSubSubNode(childs[i]);
            if (ccb != null) {
                setCheckboxChecked(ccb, checked);
                setCheckboxIndeterminate(ccb, false);
            }
            if ((ccb != null) || PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX) {
                setChildrenNodesChecked(childs[i], checked);
            }
        }
    }

    function setParentNodesChecked(domNode, checked) {
        var parent = getTreeParentItemDomNode(domNode);
        if (parent == null) { return; }
        var pcb = getTreeCheckboxDomSubSubNode(parent);

        if (pcb == null) {
            if (!PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX) {
                return; // nothing more to do, parent has no checkbox and we do not propagate via it
            }
        }

        if (checked == null) {
            // I am in indeterminate state, so all my parent are
            if (pcb != null) {
                setCheckboxChecked(pcb, false);
                setCheckboxIndeterminate(pcb, true);
            }
            if ((pcb != null) || (PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX)) {
                setParentNodesChecked(parent, null);
            }
            return;
        }

        var childs = getTreeChildrenDomNodesList(parent); // siblings
        if ((childs == null) || (childs.length <= 0)) { return; }

        var ccb;
        for (var i = 0; i < childs.length; i++) {
            ccb = getTreeCheckboxDomSubSubNode(childs[i]);
            if (ccb != null) {
                if (isCheckboxIndeterminate(ccb) || (ccb.checked != checked)) {
                    // Some or my siblingds in not in the same state as I am or they are indeterminated
                    // mark parent(s) as indeterminate
                    if (pcb != null) {
                        if (!isCheckboxIndeterminate(pcb)) {
                            setCheckboxChecked(pcb, false);
                            setCheckboxIndeterminate(pcb, true);
                        }
                    }
                    setParentNodesChecked(parent, null);
                    return;
                }
            } else if (PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX) {
                if (!isAllChildrenNodesCheckedStateMatch(childs[i], checked)) {
                    if (pcb != null) {
                        if (!isCheckboxIndeterminate(pcb)) {
                            setCheckboxChecked(pcb, false);
                            setCheckboxIndeterminate(pcb, true);
                        }
                    }
                    setParentNodesChecked(parent, null);
                    return;
                }
            }
        }

        if (pcb != null) {
            if (isCheckboxIndeterminate(pcb) || (pcb.checked != checked)) {
                // practiacally we should always go here, unless we check already checked or uncheck already unchecked
                setCheckboxChecked(pcb, checked);
                setCheckboxIndeterminate(pcb, false);
            }
        }

        if ((pcb != null) || (PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX)) {
            setParentNodesChecked(parent, checked);
        }
    }

    var dispatchOnNodeChecked = function (treeEvent) { handlers.onNodeChecked(treeEvent); };

    function onCheckboxNodeClick(e) {
        var cb = e.currentTarget;
        stopEventPropagation(e);
        var domNode = getTreeItemDomNode(cb);
        if (isCheckedPropagated) { setCheckboxIndeterminate(cb, false); } // cb cannot be indeterminate if check not propagated
        if (isCheckedPropagated) {
            setChildrenNodesChecked(domNode, cb.checked);
            setParentNodesChecked(domNode, cb.checked);
        }
        dispatchOnNodeChecked({ domNode: domNode, checked: cb.checked });
    }

    function setNodeChecked(domNode, checked) {
        domNode = getTreeItemDomNode(domNode);
        var cb = getTreeCheckboxDomSubSubNode(domNode);
        if (cb == null) { return; }
        cb.checked = checked;
        if (isCheckedPropagated) { setCheckboxIndeterminate(cb, false); } // cb cannot be indeterminate if check not propagated
        if (isCheckedPropagated) {
            setChildrenNodesChecked(domNode, cb.checked);
            setParentNodesChecked(domNode, cb.checked);
        }
        //dispatchOnNodeChecked({ domNode: domNode, checked: cb.checked }); // do not fire on sof events
    }

    // Selected

    var dispatchOnNodeSelected = function (treeEvent) { handlers.onNodeSelected(treeEvent); };

    function clearSelected() {
        var rootDomNode = getTreeRootDomNode();
        var selectedNode = rootDomNode.querySelector("LI" + "." + selectedClassName);
        if (selectedNode != null) {
            selectedNode.classList.remove(selectedClassName);
        }
    }

    function onLineNodeClick(e) {
        if (!isSelectable) { return; }
        var line = e.currentTarget;
        stopEventPropagation(e);
        var domNode = getTreeItemDomNode(line);
        if (domNode == null) { clearSelected(); return; }
        if (domNode.classList.contains(selectedClassName)) {
            // already selected - ignore
        } else {
            // select
            clearSelected();
            domNode.classList.add(selectedClassName);
            dispatchOnNodeSelected({ domNode: domNode });
        }
    }

    function setSelectedNode(domNode) {
        if (domNode == null) { clearSelected(); return; }
        domNode = getTreeItemDomNode(domNode);
        if (domNode == null) { clearSelected(); return; }
        if (domNode.classList.contains(selectedClassName)) {
            // already selected - ignore
        } else {
            // select
            clearSelected();
            domNode.classList.add(selectedClassName);
            // dispatchOnNodeSelected({ domNode: domNode }); // do not fire on programmatic change
        }
    }

    // Init
    // -------------------------------

    function fillRoot(domNode, treeChildren) {
        var level = 0;

        if (domNode.childNodes.length > 0) {
            if (needClearTarget) {
                domNode.innerHTML = '';
            }
        }

        var bag = makeTreeNodeChindrenBagDomSubNode(0);
        var realChildrenCount = 0;
        var childDomNode;

        for (var i = 0; i < treeChildren.length; i++) {
            childDomNode = makeTreeItemDomNode(treeChildren[i], level);
            if (childDomNode != null) {
                bag.appendChild(childDomNode);
                realChildrenCount++;
            }
        }

        if (realChildrenCount > 0) {
            domNode.appendChild(bag);
        }

        var ATTACH_MEGA_ROOT = true;

        if (ATTACH_MEGA_ROOT) {
            var qTreeData = { isMegaRoot: true, level: level-1 };

            if (attachSourceNode) {
                var megaRoot = { children: treeChildren };
                qTreeData.node = megaRoot;
            }

            domNode.qTreeNode = qTreeData;
        }
    }

    fillRoot(treeContainer, rootChildren);

    var WALK_CONTINUE = null; // or undefined -- default
    var WALK_STOP = false;
    var WALK_SKIPCHILDREN = 'S';
    var WALK_GO_PARENT = 'P';

    function walkSubTree(funcForDomNode, rootDomNode, level) {
        if (funcForDomNode == null) { return false; }
        if (level == null) { level = 0; }
        if (rootDomNode == null) { rootDomNode = getTreeRootDomNode(); }
        var childDomNodes = getTreeChildrenDomNodesList(rootDomNode);
        if ((childDomNodes == null) || (childDomNodes.length <= 0)) { return true; }
        for (var i = 0; i < childDomNodes.length; i++) {
            var next = funcForDomNode(childDomNodes[i]);
            if (next === WALK_STOP) { return false; }
            if (next === WALK_GO_PARENT) { return true; } // go to parent
            if (next === WALK_SKIPCHILDREN) {
                // do not dive into children
            } else {
                if (walkSubTree(funcForDomNode, childDomNodes[i], level + 1) === false) { return false; }
            }
        }
        return true;
    }

    // Result

    var result = {};
    result.treeDom = {};

    result.treeDom.getRoot = function () { return getTreeRootDomNode(); };
    result.treeDom.getChildren = function (theDomNode) { return getTreeChildrenDomNodesList(theDomNode); };
    result.treeDom.getParent = function (theDomNode) { return getTreeParentItemDomNode(theDomNode); };

    result.treeDom.findById = function (id) {
        var domNode = treeContainer.querySelector('li[qtree-node-id="' + escapeCSSAttrValue(id) + '"]');
        return domNode;
    };

    result.treeDom.getUserData = function (theDomNode) { theDomNode = getTreeItemDomNode(theDomNode); return theDomNode.qTreeNode.userData; };
    result.treeDom.getId = function (theDomNode) {
        if (!theDomNode.hasAttribute(QTREE_NODE_ID_ATTR)) { return null; }
        return theDomNode.getAttribute(QTREE_NODE_ID_ATTR);
    };

    result.treeDom.hasCheckbox = function (theDomNode) { var cb = getTreeCheckboxDomSubSubNode(theDomNode); return cb != null; };

    result.treeDom.setChecked = function (theDomNode, checked) {
        if (checked == null) { checked = true; }
        setNodeChecked(theDomNode, checked);
    };

    result.treeDom.isChecked = function (theDomNode)
    {
        var cb = getTreeCheckboxDomSubSubNode(theDomNode);
        if (cb == null) { return null; }
        if (isCheckboxIndeterminate(cb)) { return null; }
        return cb.checked;
    };

    result.treeDom.addCheckbox = function (theDomNode, checked) {
        var cb = getTreeCheckboxDomSubSubNode(theDomNode);
        if (cb == null) {
            cb = addTreeCheckboxToItemDomNode(theDomNode);
            if (checked == null) { checked = false; }
            setNodeChecked(theDomNode, checked);
        } else {
            if (checked != null) {
                setNodeChecked(theDomNode, checked);
            }
        }
    };

    result.treeDom.removeCheckbox = function (theDomNode) {
        delTreeCheckboxFromItemDomNode(theDomNode);
    };

    result.treeDom.walk = function (funcForDomNode, rootDomNode) {
        return walkSubTree(funcForDomNode, rootDomNode, 0);
    };

    me.WALK_CONTINUE = WALK_CONTINUE;
    me.WALK_STOP = WALK_STOP;
    me.WALK_SKIPCHILDREN = WALK_SKIPCHILDREN;
    me.WALK_GO_PARENT = WALK_GO_PARENT;

    result.treeDom.getAllChecked = function (rootDomNode) {
        var resultNodes = [];
        result.treeDom.walk(function (domNode) {
            var checked;
            if (!isCheckedPropagated) {
                checked = result.treeDom.isChecked(domNode);
                if (checked === true) {
                    resultNodes.push(domNode);
                }
            } else if (PROPAGATE_CHECK_VIA_NODES_WITHOUT_CHECKBOX) {
                checked = result.treeDom.isChecked(domNode);
                if (checked === true) {
                    resultNodes.push(domNode);
                    return WALK_SKIPCHILDREN; // no sense to look at children, they are checked, but we will return only roots
                } else if (checked === false) {
                    return WALK_SKIPCHILDREN; // no sense to look at children, they are unchecked
                } else {
                    // indeterminate or no checkbox -- continue
                }
            } else {
                checked = result.treeDom.isChecked(domNode);
                if (checked === true) {
                    // We will return only checked nodes if:
                    // a). parent is unchecked (so I am new check root)
                    // b). has parent w/o checkbox (so I am new root as well)
                    var parentDomNode = result.treeDom.getParent(domNode);
                    if (parentDomNode == null) {
                        resultNodes.push(domNode);
                    } else if (!result.treeDom.hasCheckbox(parentDomNode)) {
                        resultNodes.push(domNode);
                    } else if (result.treeDom.isChecked(parentDomNode) !== true) {
                        resultNodes.push(domNode);
                    }
                }
            }
        }, rootDomNode);
        return resultNodes;
    };

    result.treeDom.setAllChecked = function (checked, rootDomNode) {
        if (checked == null) { checked = true; }
        result.treeDom.walk(function (domNode) {
             var cb = getTreeCheckboxDomSubSubNode(domNode);
             if (cb != null) {
                 setCheckboxChecked(cb, checked);
                 setCheckboxIndeterminate(cb, false);
             }
        });
    };

    result.treeDom.clearSelected = function () { clearSelected(); };
    result.treeDom.setSelected = function (domNode) { setSelectedNode(domNode); };

    result.treeDom.getAllExpanded = function (rootDomNode) {
        if (rootDomNode == null) { rootDomNode = getTreeRootDomNode(); }
        var nodes = rootDomNode.querySelectorAll('li' + '.' + 'qtree-subtree-open');
        if (Array.from != null) { return Array.from(nodes); }
        var result = [];
        for (var i = 0; i < nodes.length; i++) {
            result.push(nodes[i]);
        }
        return result;
    };

    result.treeDom.setExpanded = function (theDomNode, expanded) {
        if (expanded == null) { expanded = true; }
        var domNode = getTreeItemDomNode(theDomNode); // li
        if (!isTreeNodeChildrenListPresent(domNode)) { return; } // No children
        var expandedNow = isTreeNodeChildrenListVisible(domNode);
        if (expandedNow == expanded) { return; } // nothing to do
        if (!expanded) {
            hideTreeNodeChildrenList(domNode);
        }
        else {
            showTreeNodeChildrenList(domNode);
        }

        // dispatchOnNodeToggled({ domNode: domNode, isOpen: expanded }); do not fire on software events
    };

    result.treeDom.isExpanded = function (theDomNode) {
        if (theDomNode == null) { return null; }
        var domNode = getTreeItemDomNode(theDomNode); // li
        if (!isTreeNodeChildrenListPresent(domNode)) { return null; } // No children
        return isTreeNodeChildrenListVisible(domNode);
    };

    result.treeDom.showExpandPath = function (theDomNode) {
        if (theDomNode == null) { return; }
        domNode = getTreeParentItemDomNode(getTreeItemDomNode(theDomNode)); // parent's li
        if (domNode == null) { return; }
        if (!isTreeNodeChildrenListPresent(domNode)) { return ; } // No children (strange) // bug trap
        if (!isTreeNodeChildrenListVisible(domNode)) {
            showTreeNodeChildrenList(domNode);
        }
        result.treeDom.showExpandPath(domNode);
    };

    result.treeHandlers = handlers;

    return result;
}
