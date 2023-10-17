import {InsightError} from "../IInsightFacade";
import {Key, MKey, SKey} from "./Key";
import {Query} from "./Query";
import Decimal from "decimal.js";

export class Transformations{
	public group: Group;
	public apply: Apply;
	public query: Query;
	constructor(rawT: any, q: Query) {
		let ks: string[];
		try {
			ks = Object.keys(rawT);
		} catch {
			throw new InsightError("Transformations is null or undefined");
		}
		let len = ks.length;
		if (len !== 2) {
			throw new InsightError("Transformation should have 2 keys, has" + len);
		}
		if (ks[0] === "GROUP") {
			this.group = new Group(rawT["GROUP"], q);
		} else {
			throw  new InsightError("1st key of Transformation should be 'GROUP', is" + ks[0]);
		}

		if (ks[1] === "APPLY") {
			this.apply = new Apply(rawT["APPLY"], q);
		} else {
			throw new InsightError("2nd key of Transformation should be 'APPLY', is" + ks[1]);
		}

		this.query = q;
	}

	public perform(data: any[]): any[] {
		const groups = this.group.perform(data);
		return this.apply.perform(groups, this.query.idString);
	}
}

class Group {
	public keys: Array<SKey | MKey>;
	public fields: string[];
	public rawKeys: string[];

	constructor(rawG: any, q: Query) {
		if (!(Array.isArray(rawG))) {
			throw new InsightError("GROUP should be an array of keys");
		}
		const len = rawG.length;
		if (len < 1) {
			throw new InsightError("GROUP should have at least 1 key, has" + len);
		}
		this.keys = rawG.map((rawKey) => {
			return Key.makeKey(rawKey, q);
		});
		this.fields = this.keys.map((key) => {
			return key.field;
		});
		this.rawKeys = rawG;
	}

	public perform(data: any[]): any {
		return Group.groupBy(data, this.fields);
	}

	// https://gomakethings.com/a-vanilla-js-equivalent-of-lodashs-groupby-method/
	private static groupBy(arr: any[], keys: string[]): any {
		return arr.reduce(function (group: any, item: any) {
			let kobj: any = {};
			for (const key of keys) {
				kobj[key] = item[key];
			}
			let key = JSON.stringify(kobj);
			if (!Object.keys(group).includes(key)) {
				group[key] = [];
			}
			group[key].push(item);
			return group;
		}, {});
	}

}

class Apply {
	public applyRules: ApplyRule[];
	constructor(rawA: any, q: Query) {
		if (!(Array.isArray(rawA))) {
			throw new InsightError("APPLY should be an array of applyrules");
		}
		this.applyRules = [];
		for (const rawAR of rawA) {
			let newAR = new ApplyRule(rawAR, q);
			if (this.applyRules.filter((ar) => {
				return (ar.applyKey === newAR.applyKey);
			}).length === 0) {
				this.applyRules.push(newAR);
			} else {
				throw new InsightError("no two APPLYRULEs should share an applykey with the same name");
			}
		}
	}

	public perform(groups: any, idString: string): any[] {
		let res = [];
		for (const groupedBy of Object.keys(groups)) {
			let items = groups[groupedBy];
			let groupedByObj = JSON.parse(groupedBy);
			for (const key of Object.keys(groupedByObj)) {
				let newKey = idString + "_" + key;
				groupedByObj[newKey] = groupedByObj[key];
				delete groupedByObj[key];
			}
			for (const rule of this.applyRules) {
				let applyKey = rule.applyKey;
				let token = rule.token;
				let key = rule.key;
				groupedByObj[applyKey] = ApplyRule.perform(items, applyKey, token, key);
			}
			res.push(groupedByObj);
		}
		return res;
	}
}

class ApplyRule {
	private static APPLYTOKENS = /(MAX)|(MIN)|(AVG)|(COUNT)|(SUM)/;
	private static APPLYTOKENSNUM = /(MAX)|(MIN)|(AVG)|(SUM)/;
	public applyKey: string;
	public token: string;
	public key: string;

	constructor(rawAR: any, q: Query) {
		this.applyKey = ApplyRule.makeApplyKey(rawAR);
		let [token, key] = ApplyRule.makeTokenKey(rawAR, this.applyKey, q);
		this.token = token;
		this.key = key;
	}

	private static makeTokenKey(rawAR: any, applyKey: string, q: Query): [string, string] {
		let rawTK = rawAR[applyKey];
		let ks: string[];
		try {
			ks = Object.keys(rawTK);
		} catch {
			throw new InsightError("Apply token and key is null or undefined");
		}
		if (ks.length !== 1) {
			throw new InsightError("Apply token and key should have only 1 key, has " + ks.length);
		}
		let token = ks[0];
		if (!ApplyRule.APPLYTOKENS.test(token)) {
			throw new InsightError(token + " is not one of 'MAX' | 'MIN' | 'AVG' | 'COUNT' | 'SUM'");
		}
		let rawKey = rawTK[token];
		let key = Key.makeKey(rawKey, q);
		let field = key.field;
		if (ApplyRule.APPLYTOKENSNUM.test(token)) {
			if (!(Key.isMField(field))) {
				throw new InsightError(token + " should only be requested for numeric keys, " + field + " is not");
			}
		}
		return [token, field];
	}

	private static makeApplyKey(rawAR: any): string {
		let ks: string[];
		try {
			ks = Object.keys(rawAR);
		} catch {
			throw new InsightError("ApplyRule is null or undefined");
		}
		if (ks.length !== 1) {
			throw new InsightError("ApplyRule should have only 1 key, has " + ks.length);
		}
		if (!(ks[0].includes("_"))) {
			return ks[0];
		} else {
			throw new InsightError("ApplyKey " + ks[0] + "should not contain underscore");
		}
	}

	public static perform(items: any[], applyKey: string, token: string, key: string): number {
		switch (token) {
			case "MAX": {
				return items.reduce((currMax: number, nextItem: any) => {
					return Math.max(currMax, nextItem[key]);
				}, items[0][key]);
			}
			case "MIN": {
				return items.reduce((currMax: number, nextItem: any) => {
					return Math.min(currMax, nextItem[key]);
				}, items[0][key]);
			}
			case "AVG": {
				let total = items.reduce((currTotal: Decimal, nextItem: any) => {
					let nextDecimal = new Decimal(nextItem[key]);
					return Decimal.add(currTotal,nextDecimal);
				}, new Decimal(0));
				let avg = total.toNumber() / items.length;
				return Number(avg.toFixed(2));
			}
			case "COUNT": {
				let distinct = [...new Set(items.map((item) => item[key]))];
				return distinct.length;
			}
			case "SUM": {
				let sum =  items.reduce((currTotal: number, nextItem: any) => {
					return currTotal + nextItem[key];
				},0);
				return Number(sum.toFixed(2));
			}
			default: {
				throw new InsightError(token + " is not one of 'MAX' | 'MIN' | 'AVG' | 'COUNT' | 'SUM'");
			}
		}
	}
}
