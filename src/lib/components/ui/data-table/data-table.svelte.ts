import {
	constructTable,
	type RowData,
	type Table,
	type TableFeatures,
	type TableOptions,
} from "@tanstack/table-core";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";

// table-core has no reactivity of its own: every table needs an adapter that
// creates the atoms its state and row models are built from.
const reactivity = storeReactivityBindings();

/**
 * Creates a reactive TanStack table object for Svelte.
 *
 * The table is rebuilt whenever a reactive option it reads changes, so pass
 * `data` (and any other changing option) as a getter. The returned value is a
 * proxy onto the current table: reading from it in a template or a `$derived`
 * subscribes to those options.
 *
 * @param options Table options to create the table with.
 * @returns A reactive table object.
 * @example
 * ```svelte
 * <script>
 *   const table = createSvelteTable({ features, columns, get data() { return rows } })
 * </script>
 *
 * <table>
 *   <thead>
 *     {#each table.getHeaderGroups() as headerGroup}
 *       <tr>
 *         {#each headerGroup.headers as header}
 *           <th colspan={header.colSpan}>
 *         	   <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
 *         	 </th>
 *         {/each}
 *       </tr>
 *     {/each}
 *   </thead>
 * 	 <!-- ... -->
 * </table>
 * ```
 */
export function createSvelteTable<
	TFeatures extends TableFeatures,
	TData extends RowData,
>(options: TableOptions<TFeatures, TData>): Table<TFeatures, TData> {
	const table = $derived(
		constructTable({
			...options,
			features: { coreReactivityFeature: reactivity, ...options.features },
		}),
	);

	return new Proxy({} as Table<TFeatures, TData>, {
		get(_, key) {
			const value = Reflect.get(table, key, table) as unknown;
			// Table APIs live on a shared prototype and need their instance back.
			return typeof value === "function" ? value.bind(table) : value;
		},
		has: (_, key) => key in table,
		ownKeys: () => Reflect.ownKeys(table),
		getOwnPropertyDescriptor: (_, key) =>
			Reflect.getOwnPropertyDescriptor(table, key),
	});
}
