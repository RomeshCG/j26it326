import { Button } from "@/components/ui/button"

import { Field, SectionTitle, TextInput } from "../../FormFields"

function AssetTable({ title, columns, rows, onChange, onAddRow }) {
  return (
    <div className="space-y-3">
      <SectionTitle title={title} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    <TextInput
                      id={`${title}-${index}-${column.key}`}
                      type={column.type || "text"}
                      value={row[column.key]}
                      onChange={(value) => onChange(index, column.key, value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onAddRow ? (
        <Button type="button" size="sm" variant="outline" onClick={onAddRow} className="cursor-pointer">
          Add row
        </Button>
      ) : null}
    </div>
  )
}

export default function AssetLiabilityTables({ form, onChange }) {
  function updateRows(field, rows) {
    onChange({ ...form, [field]: rows })
  }

  function updateRow(field, index, key, value) {
    const rows = [...form[field]]
    rows[index] = { ...rows[index], [key]: value }
    updateRows(field, rows)
  }

  return (
    <div className="space-y-8">
      <AssetTable
        title="Movable properties"
        columns={[
          { key: "property", label: "Movable property" },
          { key: "value", label: "Value (LKR)", type: "number" },
          { key: "vehicleNo", label: "Vehicle no." },
          { key: "tenure", label: "Free hold / mortgaged" },
        ]}
        rows={form.movableAssets}
        onChange={(index, key, value) => updateRow("movableAssets", index, key, value)}
      />

      <AssetTable
        title="Immovable properties"
        columns={[
          { key: "property", label: "Immovable property" },
          { key: "value", label: "Value (LKR)", type: "number" },
          { key: "tenure", label: "Free hold / mortgaged" },
        ]}
        rows={form.immovableAssets}
        onChange={(index, key, value) => updateRow("immovableAssets", index, key, value)}
      />

      <AssetTable
        title="Liabilities"
        columns={[
          { key: "type", label: "Liability type" },
          { key: "bank", label: "Bank / institute" },
          { key: "amountOutstanding", label: "Outstanding (LKR)", type: "number" },
          { key: "monthlyPayment", label: "Monthly payment", type: "number" },
          { key: "security", label: "Security" },
        ]}
        rows={form.liabilities}
        onChange={(index, key, value) => updateRow("liabilities", index, key, value)}
      />

      <Field id="totalAssetsNote" label="Total asset value (auto)">
        <TextInput
          id="totalAssetsNote"
          disabled
          value={String(
            [...form.movableAssets, ...form.immovableAssets].reduce(
              (sum, row) => sum + (Number(row.value) || 0),
              0
            )
          )}
        />
      </Field>
    </div>
  )
}
