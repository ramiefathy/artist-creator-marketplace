'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './DataTable.module.css';

export type DataTableAlign = 'left' | 'center' | 'right';

export type DataTableColumn<Row> = {
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  align?: DataTableAlign;
  width?: string;
};

export interface DataTableProps<Row> {
  caption?: string;
  columns: Array<DataTableColumn<Row>>;
  data: Array<Row>;
  getRowKey: (row: Row) => string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
}

export function DataTable<Row>({ caption, columns, data, getRowKey, emptyState, onRowClick }: DataTableProps<Row>) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {caption ? <caption className={styles.caption}>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(styles.th, getAlignClass(col.align))}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length ? (
            data.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn(styles.tr, onRowClick && styles.clickable)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn(styles.td, getAlignClass(col.align))}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className={styles.empty} colSpan={columns.length}>
                {emptyState ?? 'No data.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function getAlignClass(align: DataTableAlign | undefined) {
  if (align === 'center') return styles.alignCenter;
  if (align === 'right') return styles.alignRight;
  return styles.alignLeft;
}

