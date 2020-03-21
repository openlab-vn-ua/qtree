# qtree
Quick pure html + java script tree view system (optimised for thousands nodes)

## Propose
This tree implemenation allows to create expandable UI/LI tree structures with tenth of thosusands of nodes.
* Pure html + java script (custom css not required) 
* Maximum workload offloaded to browser
* Optionally:
    * Supports nodes with checkboxes
        * Supports checkbox propagation
        * Supports mixed trees (with some nodes with checkboxes, some without)
        * Supports indeterminate checbox state (automatically)
    * Supports selectable nodes
* Supports html and text nodes
* Supports mutiple roots

## How to use
```
<div id="treeContainer"></div>
<script>
    var treeData = [
        { text: '1-Root', children: [{ text: '1-1 Node' }, { text: '1-2 Node', id: 'test id 12', children: [] }] },
        { text: '2-Root', id:'root_2'},
        { html: '3-Root <b>with html</b> content' }
    ];
    var opts = { hasCheckboxes: true, isSelectable: true };
    var tree = qTree(document.getElementById('treeContainer'), treeData, opts);
    tree.treeHandlers.onNodeToggled = function (e) { console.log('Node toggled', [e.domNode, e.isOpen]); }
    tree.treeHandlers.onNodeChecked = function (e) { console.log('Node checked', [e.domNode, e.checked]); }
    tree.treeHandlers.onNodeSelected = function (e) { console.log('Node selected', [e.domNode]); }
    tree.treeDom.showExpandPath(tree.treeDom.findById('test id 12'));
    tree.treeDom.setSelected(tree.treeDom.findById('test id 12'));
    tree.treeDom.setChecked(tree.treeDom.findById('root_2'));
</script>
```

