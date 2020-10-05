import { Component, Input, EventEmitter, Output, Injectable, OnInit } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
  MatTreeFlatDataSource,
  MatTreeFlattener
} from '@angular/material/tree';
import { BehaviorSubject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { RestService } from 'src/app/service/rest.service';

/**
 * Node for note type item
 */
export class NoteTypeNode {
  children?: NoteTypeNode[];
  item: string;
}

/** Flat note type item node with expandable and level information */
export class NoteTypeFlatNode {
  item: string;
  level: number;
  expandable: boolean;
}

/**
 * The Json object for note type list data.
 */
let TREE_DATA1;
let TREE_DATA: NoteTypeNode[] = [
  {
    item: 'Red Flags',
    children: [
      { item: 'Apple' },
      { item: 'Banana' },
      {
        item: 'Fruit loops',
        children: [
          { item: 'Cherry' },
          { item: 'Grapes', children: [{ item: 'Oranges' }] }
        ]
      }
    ]
  },
  {
    item: 'Safety',
    children: [
      {
        item: 'Green',
        children: [{ item: 'Broccoli' }, { item: 'Brussels sprouts' }]
      },
      {
        item: 'Orange',
        children: [{ item: 'Pumpkins' }, { item: 'Carrots' }]
      }
    ]
  },
  {
    item: 'Daignostics',
    children: [
      {
        item: 'Green',
        children: [{ item: 'Broccoli' }, { item: 'Brussels sprouts' }]
      },
      {
        item: 'Orange',
        children: [{ item: 'Pumpkins' }, { item: 'Carrots' }]
      }
    ]
  }
];

/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
@Injectable({ providedIn: 'root' })
export class ChecklistDatabase {
  dataChange = new BehaviorSubject<NoteTypeNode[]>([]);
  treeData: any[];

  get data(): NoteTypeNode[] {
    return this.dataChange.value;
  }

  constructor(private rest: RestService) {
    this.initialize();
  }

  initialize() {
    // this.treeData = TREE_DATA;
    this.rest.getNoteTypeCategories().subscribe(noteTypes => {
      this.treeData = noteTypes;
      // Build the tree nodes from Json object. The result is a list of `NoteTypeItemNode` with nested
      //     file node as children.
      const data = this.treeData;

      // Notify the change.
      this.dataChange.next(data);
    });
  }

  public filter(filterText: string) {
    let filteredTreeData;
    if (filterText) {
      filteredTreeData = this.filterTree(this.treeData, filterText);
    } else {
      // Return the initial tree
      filteredTreeData = this.treeData;
    }

    // Build the tree nodes from Json object. The result is a list of `NoteTypeItemNode` with nested
    // file node as children.
    const data = filteredTreeData;
    // Notify the change.
    this.dataChange.next(data);
  }

  // Filter the tree
  filterTree(array, text) {
    const getChildren = (result, object) => {
      if (object.item .toLowerCase() === text.toLowerCase() ) {
        result.push(object);
        return result;
      }
      if (Array.isArray(object.children)) {
        const children = object.children.reduce(getChildren, []);
        if (children.length) {
          result.push({ ...object, children });
        }
      }
      return result;
    };

    return array.reduce(getChildren, []);
  }
}

@Component({
  selector: 'data-input',
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss']
})

export class InputComponent {
  @Input() groups;
  @Input() drivers;
  @Input() vehicles;

  @Input() loading;
  filter = '';
  types = ['Group', 'Driver', 'Vehicle'];
  queries = ['Events', 'Trips'];

  request = {
    query: this.queries[0],
    entityType: this.types[0],
    startDate: undefined,
    endDate: undefined,
    entityID: undefined,
    noteTypes: undefined
  };

  @Output() queryEvent = new EventEmitter();
  @Output() filterEvent = new EventEmitter<string>();
  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap = new Map<NoteTypeFlatNode, NoteTypeNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap = new Map<NoteTypeNode, NoteTypeFlatNode>();

  /** A selected parent node to be inserted */
  selectedParent: NoteTypeFlatNode | null = null;

  treeControl: FlatTreeControl<NoteTypeFlatNode>;

  treeFlattener: MatTreeFlattener<NoteTypeNode, NoteTypeFlatNode>;

  dataSource: MatTreeFlatDataSource<NoteTypeNode, NoteTypeFlatNode>;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<NoteTypeFlatNode>(true /* multiple */);

  /// Filtering
  myControl = new FormControl();
  options: string[] = ['One', 'Two', 'Three'];
  filteredOptions: Observable<string[]>;

  constructor(private _database: ChecklistDatabase) {

    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren
    );
    this.treeControl = new FlatTreeControl<NoteTypeFlatNode>(
      this.getLevel,
      this.isExpandable
    );
    this.dataSource = new MatTreeFlatDataSource(
      this.treeControl,
      this.treeFlattener
    );

    _database.dataChange.subscribe(data => {
      this.dataSource.data = data;
    });
  }

  setTypes() {
    if (this.request.query === this.queries[0]) {
      this.types = ['Group', 'Driver', 'Vehicle'];
    } else if (this.request.query === this.queries[1]) {
      this.types = ['Driver', 'Vehicle'];
    }
    this.request.entityType = this.types[0];
    this.request.entityID = undefined;
  }

  onStartChange(event) {
    this.request.startDate = this.formatDate(event.value);
    this.query();
  }

  onEndChange(event) {
    this.request.endDate = this.formatDate(event.value);
    this.query();
  }

  formatDate(date: Date): string {
    let format: string = '';
    let month: number = date.getMonth() + 1;
    format += month < 10 ? '0' + month : month;
    format += date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    format += date.getFullYear();
    return format;
  }

  query() {
    this.queryEvent.emit(this.request);
  }

  onFilterChange(event) {
    this.filterEvent.emit(event.target.value);
  }

  getLevel = (node: NoteTypeFlatNode) => node.level;

  isExpandable = (node: NoteTypeFlatNode) => node.expandable;

  getChildren = (node: NoteTypeNode): NoteTypeNode[] => node.children;

  hasChild = (_: number, _nodeData: NoteTypeFlatNode) => _nodeData.expandable;

  hasNoContent = (_: number, _nodeData: NoteTypeFlatNode) => _nodeData.item === '';

  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  transformer = (node: NoteTypeNode, level: number) => {
    const existingNode = this.nestedNodeMap.get(node);
    const flatNode =
      existingNode && existingNode.item === node.item
        ? existingNode
        : new NoteTypeFlatNode();
    flatNode.item = node.item;
    flatNode.level = level;
    flatNode.expandable = !!node.children;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  };

  /** Whether all the descendants of the node are selected. */
  descendantsAllSelected(node: NoteTypeFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected = descendants.every(child =>
      this.checklistSelection.isSelected(child)
    );
    return descAllSelected;
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: NoteTypeFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child =>
      this.checklistSelection.isSelected(child)
    );
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle the note type item selection. Select/deselect all the descendants node */
  noteTypeItemSelectionToggle(node: NoteTypeFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);

    // Force update for the parent
    descendants.every(child => this.checklistSelection.isSelected(child));
    this.checkAllParentsSelection(node);
  }

  /** Toggle a leaf note type item selection. Check all the parents to see if they changed */
  noteTypeLeafItemSelectionToggle(node: NoteTypeFlatNode): void {
    this.checklistSelection.toggle(node);
    this.checkAllParentsSelection(node);
  }

  /* Checks all the parents when a leaf node is selected/unselected */
  checkAllParentsSelection(node: NoteTypeFlatNode): void {
    let parent: NoteTypeFlatNode | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }

  /** Check root node checked state and change it accordingly */
  checkRootNodeSelection(node: NoteTypeFlatNode): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected = descendants.every(child =>
      this.checklistSelection.isSelected(child)
    );
    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }

  /* Get the parent node of a node */
  getParentNode(node: NoteTypeFlatNode): NoteTypeFlatNode | null {
    console.log(this.checklistSelection.selected);
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  getSelectedItems(): string {
    if (!this.checklistSelection.selected.length) {
      return 'Note Types';
    }
    this.request.noteTypes = this.checklistSelection.selected.map(s => s.item).join(',');
    return this.request.noteTypes;
  }

  filterChanged(filterText: string) {
    console.log('filterChanged', filterText);
    // ChecklistDatabase.filter method which actually filters the tree and gives back a tree structure
    this._database.filter(filterText);
    if (filterText) {
      this.treeControl.expandAll();
    } else {
      this.treeControl.collapseAll();
    }
  }
}
