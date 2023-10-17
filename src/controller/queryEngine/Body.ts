import {InsightError} from "../IInsightFacade";
import {MKey, SKey} from "./Key";
import {Query} from "./Query";

type FilterPredicate = (item: any) => boolean;

export class Body{
	public filter?: Filter;
	public query: Query;

	constructor(body: any, q: Query) {
		this.query = q;
		let ks;
		try {
			ks = Object.keys(body);
		} catch (e) {
			throw new InsightError("body cannot be null or undefined");
		}
		const len = ks.length;
		if (len === 1 ) {
			this.filter = makeFilter(body, q);
		} else {
			if (len !== 0) {
				throw new InsightError("Invalid Body");
			}
		}
	}

	public perform(data: any[]): any[] {
		if (!(this.filter === undefined)) {
			return data.filter(this.filter.filterPredicate);
		} else {
			return data;
		}
	}
}

function makeFilter(filter: any, q: Query): Filter {
	let ks = Object.keys(filter);
	let len = ks.length;
	if (len !== 1) {
		throw new InsightError("the length of a filter is not 1");
	}
	let c = ks[0];
	if (/(AND)|(OR)/.test(c)) {
		return new LogicComparison(filter,c, q);
	} else if(/(LT)|(GT)|(EQ)/.test(c)) {
		return new MComparison(filter, c, q);
	} else if(/(IS)/.test(c)) {
		return new SComparison(filter, c, q);
	} else if(/(NOT)/.test(c)) {
		return new Negation(filter, c, q);
	} else {
		throw new InsightError();
	}
}

interface Filter {
	filterPredicate: FilterPredicate;
	comparator: string;
}

class LogicComparison implements Filter{
	public filterPredicate: (item: any) => boolean;
	public comparator: string;
	public loFilters: Filter[];

	constructor(filter: any, c: string, q: Query) {
		if (!( c === "AND" || c === "OR") ){
			throw new InsightError("invalid Logic Comparator");
		}
		this.comparator = c;
		this.loFilters = LogicComparison.makeFilters(filter[c], q);
		this.filterPredicate = this.makePredicate();
	}

	private static makeFilters(lof: any[], q: Query): Filter[] {
		if (lof.length < 1) {
			throw new InsightError("Invalid list of filters in Logic Comparison");
		}
		let res: Filter[] = [];
		for (const f of lof) {
			res.push(makeFilter(f, q));
		}
		return res;
	}

	private makePredicate(): FilterPredicate {
		let p: FilterPredicate;
		let loP: FilterPredicate[];
		loP = this.loFilters.map(function (f: Filter): FilterPredicate {
			return f.filterPredicate;
		});
		// https://stackoverflow.com/questions/54801835/type-safe-predicate-functions-in-typescript
		if (this.comparator === "AND") {
			p = loP.reduce((p1, p2) => (i: any) => p1(i) && p2(i));
		} else {
			p = loP.reduce((p1, p2) => (i: any) => p1(i) || p2(i));
		}
		return p;
	}

}

class MComparison implements Filter {
	public filterPredicate: (item: any) => boolean;
	public comparator: string;
	public field: string;
	public number: number;

	constructor(filter: any, c: string, q: Query) {
		if (!( c === "LT" || c === "GT" || c === "EQ") ){
			throw new InsightError("invalid M Comparator");
		}
		this.comparator = c;
		let ks = Object.keys(filter[c]);
		let len = ks.length;
		if (len !== 1) {
			throw new InsightError("invalid M Comparison");
		}
		let mkey = new MKey(ks[0], q);
		this.field  = mkey.field;
		this.number = filter[c][ks[0]];
		this.filterPredicate = this.makePredicate();
	}

	private makePredicate(): FilterPredicate {
		let comparator = this.comparator;
		let field = this.field;
		let number = this.number;

		let equal = (item: any) => {
			return item[this.field] === number;
		};

		let lessThan = (item: any) => {
			return item[field] < number;
		};

		let greaterThan = (item: any) => {
			return item[field] > number;
		};

		if (comparator === "LT") {
			return lessThan;
		} else if (comparator === "GT") {
			return greaterThan;
		} else {
			return equal;
		}
	}
}

class SComparison implements Filter {
	public filterPredicate: (item: any) => boolean;
	public comparator: string;
	public field: string;
	public inputString: string;

	constructor(filter: any , c: string, q: Query) {
		if (c !== "IS" ){
			throw new InsightError("invalid  S Comparator");
		}
		this.comparator = c;
		let ks = Object.keys(filter[c]);
		let len = ks.length;
		if (len !== 1) {
			throw new InsightError("invalid S Comparison");
		}
		let skey = new SKey(ks[0], q);
		this.field = skey.field;
		this.inputString = filter[c][ks[0]];
		this.filterPredicate = this.makePredicate();
	}

	private static isValidInput(s: string): boolean {
		let input = s;
		if (input.startsWith("*")) {
			input = input.slice(1);
		}
		if (input.endsWith("*")) {
			input = input.slice(0, input.length - 1);
		}
		return ((!(input.includes("*")) || input.length === 0));
	}

	private makePredicate(): FilterPredicate{
		let comparator = this.comparator;
		let field = this.field;
		let inputStr = this.inputString;

		if (!SComparison.isValidInput(inputStr)) {
			throw new InsightError("invalid input string \" " + inputStr + "\"");
		}

		let p: FilterPredicate;
		if (inputStr.startsWith("*") && inputStr.endsWith("*")) {
			const inputBody = inputStr.slice(1, inputStr.length - 1);
			p = (item: any) => {
				return (inputBody === "" || item[field].includes(inputBody));
			};
		} else if (inputStr.startsWith("*")) {
			p = (item: any) => {
				return (item[field].endsWith(inputStr.slice(1)));
			};
		} else if (inputStr.endsWith("*")) {
			p = (item: any) => {
				return (item[field].startsWith(inputStr.slice(0,inputStr.length - 1)));
			};
		} else {
			p = (item: any) => {
				return (item[field] === inputStr);
			};
		}
		return p;
	}

}

class Negation implements Filter {
	public comparator: string;
	public filterPredicate: FilterPredicate;
	public filter: Filter;

	constructor(filter: any , c: string, q: Query) {
		if (c !== "NOT" ){
			throw new InsightError("invalid Negation");
		}
		this.comparator = "NOT";
		this.filter = makeFilter(filter["NOT"], q);
		this.filterPredicate = this.makePredicate();
	}

	private makePredicate(): FilterPredicate {
		let pToNegate: FilterPredicate = this.filter.filterPredicate;
		// https://stackoverflow.com/questions/54801835/type-safe-predicate-functions-in-typescript
		const not = (p: FilterPredicate) => (i: any) => !p(i);
		return not(pToNegate);
	}
}
