import {InsightError, ResultTooLargeError} from "../IInsightFacade";
import {Body} from "./Body";
import {Options} from "./Options";
import {Transformations} from "./Transformations";
import fs from "fs";

export class Query{
	public body: Body;
	public options: Options;
	public transformations: Transformations | undefined;

	public idString: string = "";
	public static data: any[] = [];

	constructor(query: any) {
		let ks;
		try {
			ks = Object.keys(query);
		} catch (e) {
			throw new InsightError("query is null or undifined");
		}
		const len = ks.length;
		if (len !== 2 && len !== 3) {
			throw new InsightError("missing query parts");
		}
		if (ks[0] === "WHERE") {
			this.body = new Body(query["WHERE"], this);
		} else {
			throw new InsightError("Missing WHERE");
		}
		if (ks[1] === "OPTIONS") {
			this.options = new Options(query["OPTIONS"], this);
		} else {
			throw new InsightError("Missing OPTIONS");
		}
		// if (len === 3 && ks[2] === "TRANSFORMATIONS") {
		// 	this.transformations = new Transformations(query["TRANSFORMATIONS"], this);
		// } else {
		// 	throw new InsightError("Missing TRANSFORMATIONS");
		// }
		if (len === 3) {
			if (ks[2] === "TRANSFORMATIONS") {
				this.transformations = new Transformations(query["TRANSFORMATIONS"], this);
			} else {
				throw new InsightError("Missing TRANSFORMATIONS");
			}
		}
	}

	public loadData(): any[] {
		return JSON.parse(fs.readFileSync("data/" + this.idString + ".json").toString());
	}
}

export function performQuery(newQ: any[]): any[]{
	console.log("newing");
	let query = new Query(newQ);
	const loadedData = query.loadData();
	let filteredData = query.body.perform(loadedData);
	if (query.transformations) {
		filteredData = query.transformations.perform(filteredData);
		const sortedData = query.options.perform(filteredData);
		if (sortedData.length > 5000) {
			throw new ResultTooLargeError("result has" + filteredData.length + "rows");
		}
		console.log("returning");
		return sortedData;
	} else {
		if (filteredData.length > 5000) {
			throw new ResultTooLargeError("result has" + filteredData.length + "rows");
		}
		const sortedData = query.options.perform(filteredData);
		return sortedData.map((item: any) => {
			return Object.fromEntries(Object.entries(item).map(([colName, value]) => {
				let idColName = query.idString + "_" + colName;
				return [idColName, value];
			}));
		});
	}
}
