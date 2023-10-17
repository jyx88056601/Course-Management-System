import {InsightError} from "../IInsightFacade";
import {AnyKey, ApplyKey, MKey, SKey} from "./Key";
import {Query} from "./Query";

export class Options {
	public columns: Columns;
	public sort?: DirectionSort|DefaultSort;

	/**
	 * construct an Options Object from raw json obj
	 *
	 * @param rawOptions parsed json object in the form of {' COLUMNS (', ' SORT)? '}
	 *
	 * @param query
	 **/
	constructor(rawOptions: any, query: Query) {
		let ks;
		try {
			ks = Object.keys(rawOptions);
		} catch (e) {
			throw new InsightError("options is null or undifined");
		}
		const len = ks.length;

		if (len < 1 || len > 2) {
			throw new InsightError("OPTIONS should only have 1 or 2 key, has " + len);
		}

		if (ks[0] !== "COLUMNS") {
			throw new InsightError("1st key of OPTIONS should be COLUMNS, is " + ks[0]);
		} else if (len === 2 && ks[1] !== "ORDER"){
			throw new InsightError("2nd key of OPTIONS should be ORDER, is " + ks[0]);
		}

		this.columns = new Columns(rawOptions["COLUMNS"], query);
		if (len === 2) {
			this.sort = Sort.makeSort(rawOptions["ORDER"], this.columns, query);
		}
	}

	public perform(filteredData: any[]): any[] {
		const selectedData = this.columns.perform(filteredData);
		if (this.sort) {
			const sortedData = this.sort.perform(selectedData);
		}
		return selectedData;
	}
}

class Columns {
	// TODO check apply keys
	public columns: Array<SKey|MKey|ApplyKey>;
	public rawColumns: string[];
	public mapRawKey: Map<string, SKey|MKey|ApplyKey> = new Map<string, SKey|MKey|ApplyKey>();
	public query: Query;

	/**
	 * construct a column instance from json
	 *
	 * @param rawColumns [' ANYKEY (',' ANYKEY)* ']
	 *
	 * @param query
	 **/
	constructor(rawColumns: any, query: Query) {
		let columns: any[];
		if (Array.isArray(rawColumns)){
			columns = rawColumns;
			const len = columns.length;
			if (len < 1) {
				throw new InsightError("COLUMNS should have at least 1 element, has " + len);
			}
		} else {
			throw new InsightError("COLUMNS should be an array");
		}
		columns.map((item) => {
			if (typeof item === "string") {
				this.mapRawKey.set(item, AnyKey.makeAnyKey(item, query));
			} else {
				throw new InsightError("column names should be string");
			}
		});
		this.rawColumns = Array.from(this.mapRawKey.keys());
		this.columns = Array.from(this.mapRawKey.values());
		this.query = query;

		if (query.transformations) {
			let keysAppearsInTransformation: string[] = [];
			keysAppearsInTransformation.concat(query.transformations.group.rawKeys);
			for (const rule of query.transformations.apply.applyRules) {
				keysAppearsInTransformation.push(rule.applyKey);
			}
			if (this.rawColumns.reduce((res: boolean, colName) => {
				return res && (keysAppearsInTransformation.indexOf(colName) === -1);
			}, true)) {
				return;
			} else {
				throw new InsightError("all COLUMNS must be  GROUP keys or to applykeys");
			}
		}
	}

	public perform(filteredData: any[]): any[] {
		// https://stackoverflow.com/questions/5072136/javascript-filter-for-objects
		const loColNames = this.getColNames();
		return filteredData.map(
			(item: any) => {
				const entries = Object.entries(item).filter(([colName,value]) => {
					return loColNames.includes(colName);
				});
				return Object.fromEntries(entries);
			});
	}

	private getColNames(): string[] {
		return this.columns.map((columnKey): string => {
			if (columnKey instanceof SKey || columnKey instanceof MKey) {
				if (columnKey.query.transformations) {
					return columnKey.idString + "_" + columnKey.field;
				} else {
					return columnKey.field;
				}
			} else {
				return columnKey.applyKey;
			}
		});
	}
}

abstract class Sort {
	protected selected: Columns;
	protected query: Query;

	protected constructor(rawSort: any, selected: Columns, query: Query) {
		this.selected = selected;
		this.query = query;
	}

	public static makeSort(rawSort: any, selected: Columns, query: Query) {
		if (typeof rawSort === "string") {
			return new DefaultSort(rawSort, selected, query);
		} else if ((typeof rawSort === "object")) {
			return new DirectionSort(rawSort, selected, query);
		}
	}

	public abstract perform(selectedData: any[]): any[];
}

class DirectionSort extends Sort {
	private static DIRECTION = /(UP)|(DOWN)/;
	public direction: string;
	public keys: Array<ApplyKey | SKey | MKey | undefined>;

	constructor(rawSort: any, selected: Columns, query: Query) {
		super(rawSort, selected, query);
		const ks = Object.keys(rawSort);
		const len = ks.length;

		if (len !== 2) {
			throw new InsightError("Default Sort should have 2 keys, has " + len);
		}
		if (ks[0] !== "dir") {
			throw new InsightError("1st key of Defualt Sort should be 'dir', is " + ks[0]);
		}
		if (ks[1] !== "keys") {
			throw new InsightError("1st key of Defualt Sort should be 'keys', is " + ks[1]);
		}

		const dir = rawSort["dir"];
		if (DirectionSort.DIRECTION.test(dir)) {
			this.direction = dir;
		} else {
			throw new InsightError("sort direction should be 'UP' or 'DOWN', is " + dir);
		}

		let lok: any[];
		if (Array.isArray(rawSort["keys"])) {
			lok = rawSort["keys"];
			if (lok.length < 1) {
				throw new InsightError("should have at least 1 sort keys, has" + lok.length);
			}
		} else {
			throw new InsightError("sort keys should be an array");
		}
		this.keys = lok.map((rawAnyKey) => {
			if (typeof rawAnyKey === "string") {
				if (selected.mapRawKey.get(rawAnyKey) === undefined) {
					throw new InsightError("sort key must be in selected columns");
				} else {
					return selected.mapRawKey.get(rawAnyKey);
				}
			} else {
				throw new InsightError("column names should be string");
			}
		});
	}

	public perform(selectedData: any[]): any[] {
		let loSortBy = this.keys;
		let loSortByColNames: string[];
		loSortByColNames = loSortBy.map(DirectionSort.getSortKeys);
		let sorted = selectedData.sort(compare);

		if (this.direction === "DOWN") {
			sorted = sorted.reverse();
		}
		return sorted;

		function compare(i1: any, i2: any): number {
			let i = 0;
			while (i < loSortByColNames.length) {
				let colName = loSortByColNames[i];
				let val1: string | number = i1[colName];
				let val2: string | number = i2[colName];
				if (val1 < val2) {
					return -1;
				}
				if (val1 > val2) {
					return 1;
				}
				if (val1 === val2) {
					i++;
				}
			}
			return 0;
		}
	}

	private static getSortKeys(key: ApplyKey | SKey | MKey | undefined): string {
		if (key instanceof SKey || key instanceof MKey) {
			if (key.query.transformations) {
				return key.idString + "_" + key.field;
			} else {
				return  key.field;
			}
		} else if (key instanceof ApplyKey){
			return key.applyKey;
		} else {
			throw new Error("unexpected");
		}
	}
}

class DefaultSort extends Sort {
	public sortKey: SKey | MKey | ApplyKey | undefined;
	constructor(rawSort: any, selected: Columns, query: Query) {
		super(rawSort, selected, query);
		if (typeof rawSort === "string") {
			if (selected.mapRawKey.get(rawSort)) {
				this.sortKey =  selected.mapRawKey.get(rawSort);
			} else {
				throw new InsightError("sort key must be in selected columns");
			}
		} else {
			throw new InsightError("column name should be string");
		}
	}

	public perform(selectedData: any[]): any[] {
		let sortBy = this.sortKey;
		let sortByColName: string;
		if (sortBy instanceof SKey || sortBy instanceof MKey) {
			if (sortBy.query.transformations) {
				sortByColName =  sortBy.idString + "_" + sortBy.field;
			} else {
				sortByColName =  sortBy.field;
			}
		} else if (sortBy instanceof ApplyKey){
			sortByColName = sortBy.applyKey;
		} else {
			throw new Error("unexpected");
		}
		return selectedData.sort(compare);
		function compare(i1: any, i2: any): number {
			let val1: string | number = i1[sortByColName];
			let val2: string | number = i2[sortByColName];
			if (val1 < val2) {
				return -1;
			}
			if (val1 > val2) {
				return 1;
			}
			return 0;
		}
	}
}

