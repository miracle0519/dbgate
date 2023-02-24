import uuidv1 from 'uuid/v1';
import _omit from 'lodash/omit';
import type {
  ColumnInfo,
  ConstraintInfo,
  ForeignKeyInfo,
  IndexInfo,
  PrimaryKeyInfo,
  TableInfo,
  UniqueInfo,
} from 'dbgate-types';
import _ from 'lodash';

export interface EditorColumnInfo extends ColumnInfo {
  isPrimaryKey?: boolean;
}

export function fillEditorColumnInfo(column: ColumnInfo, table: TableInfo): EditorColumnInfo {
  return {
    isPrimaryKey: !!table?.primaryKey?.columns?.find(x => x.columnName == column.columnName),
    dataType: _.isEmpty(column) ? 'int' : undefined,
    ...column,
  };
}

function processPrimaryKey(table: TableInfo, oldColumn: EditorColumnInfo, newColumn: EditorColumnInfo): TableInfo {
  if (!oldColumn?.isPrimaryKey && newColumn?.isPrimaryKey) {
    let primaryKey = table?.primaryKey;
    if (!primaryKey) {
      primaryKey = {
        constraintType: 'primaryKey',
        pureName: table.pureName,
        schemaName: table.schemaName,
        columns: [],
      };
    }
    return {
      ...table,
      primaryKey: {
        ...primaryKey,
        columns: [
          ...primaryKey.columns,
          {
            columnName: newColumn.columnName,
          },
        ],
      },
    };
  }

  if (oldColumn?.isPrimaryKey && !newColumn?.isPrimaryKey) {
    let primaryKey = table?.primaryKey;
    if (primaryKey) {
      primaryKey = {
        ...primaryKey,
        columns: table.primaryKey.columns.filter(x => x.columnName != oldColumn.columnName),
      };
      if (primaryKey.columns.length == 0) {
        return {
          ...table,
          primaryKey: null,
        };
      }
      return {
        ...table,
        primaryKey,
      };
    }
  }

  return table;
}

export function editorAddColumn(table: TableInfo, column: EditorColumnInfo): TableInfo {
  let res = {
    ...table,
    columns: [...(table?.columns || []), { ...column, pairingId: uuidv1() }],
  };

  res = processPrimaryKey(res, null, column);

  return res;
}

export function editorModifyColumn(table: TableInfo, column: EditorColumnInfo): TableInfo {
  const oldColumn = table?.columns?.find(x => x.pairingId == column.pairingId);

  let res = {
    ...table,
    columns: table.columns.map(col => (col.pairingId == column.pairingId ? _omit(column, ['isPrimaryKey']) : col)),
  };
  res = processPrimaryKey(res, fillEditorColumnInfo(oldColumn, table), column);

  return res;
}

export function editorDeleteColumn(table: TableInfo, column: EditorColumnInfo): TableInfo {
  let res = {
    ...table,
    columns: table.columns.filter(col => col.pairingId != column.pairingId),
  };

  res = processPrimaryKey(res, column, null);

  return res;
}

export function editorAddConstraint(table: TableInfo, constraint: ConstraintInfo): TableInfo {
  const res = {
    ...table,
  };

  if (constraint.constraintType == 'primaryKey') {
    res.primaryKey = {
      pairingId: uuidv1(),
      ...constraint,
    } as PrimaryKeyInfo;
  }

  if (constraint.constraintType == 'foreignKey') {
    res.foreignKeys = [
      ...(res.foreignKeys || []),
      {
        pairingId: uuidv1(),
        ...constraint,
      } as ForeignKeyInfo,
    ];
  }

  if (constraint.constraintType == 'index') {
    res.indexes = [
      ...(res.indexes || []),
      {
        pairingId: uuidv1(),
        ...constraint,
      } as IndexInfo,
    ];
  }

  if (constraint.constraintType == 'unique') {
    res.uniques = [
      ...(res.uniques || []),
      {
        pairingId: uuidv1(),
        ...constraint,
      } as UniqueInfo,
    ];
  }

  return res;
}

export function editorModifyConstraint(table: TableInfo, constraint: ConstraintInfo): TableInfo {
  const res = {
    ...table,
  };

  if (constraint.constraintType == 'primaryKey') {
    res.primaryKey = {
      ...res.primaryKey,
      ...constraint,
    };
  }

  if (constraint.constraintType == 'foreignKey') {
    res.foreignKeys = table.foreignKeys.map(fk =>
      fk.pairingId == constraint.pairingId ? { ...fk, ...constraint } : fk
    );
  }

  if (constraint.constraintType == 'index') {
    res.indexes = table.indexes.map(fk => (fk.pairingId == constraint.pairingId ? { ...fk, ...constraint } : fk));
  }

  if (constraint.constraintType == 'unique') {
    res.uniques = table.uniques.map(fk => (fk.pairingId == constraint.pairingId ? { ...fk, ...constraint } : fk));
  }

  return res;
}

export function editorDeleteConstraint(table: TableInfo, constraint: ConstraintInfo): TableInfo {
  const res = {
    ...table,
  };

  if (constraint.constraintType == 'primaryKey') {
    res.primaryKey = null;
  }

  if (constraint.constraintType == 'foreignKey') {
    res.foreignKeys = table.foreignKeys.filter(x => x.pairingId != constraint.pairingId);
  }

  if (constraint.constraintType == 'index') {
    res.indexes = table.indexes.filter(x => x.pairingId != constraint.pairingId);
  }

  if (constraint.constraintType == 'unique') {
    res.uniques = table.uniques.filter(x => x.pairingId != constraint.pairingId);
  }

  return res;
}
