import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto rounded-xl border border-gray-800 bg-[#12161B]">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm text-left text-gray-300", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-gray-900/80 text-xs uppercase font-bold text-gray-400 border-b border-gray-800", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("divide-y divide-gray-800/60", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-gray-800 bg-gray-900/50 font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, onClick, ...props }) {
  return (
    <tr
      data-slot="table-row"
      onClick={onClick}
      className={cn(
        "transition-colors hover:bg-gray-900/60",
        onClick && "cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      className={cn("px-4 py-3 align-middle font-bold text-gray-400 whitespace-nowrap", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-4 py-3 align-middle whitespace-nowrap text-sm text-gray-200", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-gray-500", className)}
      {...props}
    />
  );
}

function DataTable({ columns = [], data = [], keyField = 'id' }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col, idx) => (
            <TableHead key={idx}>{col.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center py-6 text-gray-500">
              No records available.
            </TableCell>
          </TableRow>
        ) : (
          data.map((row, rIdx) => (
            <TableRow key={row[keyField] || rIdx}>
              {columns.map((col, cIdx) => (
                <TableCell key={cIdx}>
                  {col.cell ? col.cell(row) : row[col.accessorKey]}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
};
