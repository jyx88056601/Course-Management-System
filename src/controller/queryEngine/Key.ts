import {InsightError} from "../IInsightFacade";
import {Query} from "./Query";

export class AnyKey {
	protected static validKey = /[^_]+_.*/;
	public static makeAnyKey(k: string, query: Query): ApplyKey|Key {
		if (!k.includes("_")) {
			return new ApplyKey(k);
		} else if (Key.validKey.test(k)) {
			return Key.makeKey(k, query);
		} else {
			throw  new InsightError("invalid ANYKEY");
		}
	}

}

export class Key extends AnyKey{
	protected static roomSField = /(fullname)|(shortname)|(number)|(name)|(address)|(type)|(furniture)|(href)/
	protected static courseSField = /(dept)|(id)|(instructor)|(title)|(uuid)/
	protected static roomMField = /(lat)|(lon)|(seats)/
	protected static courseMField = /(avg)|(pass)|(fail)|(audit)|(year)/

	public query: Query;
	public idString: string;
	public field: string;

	protected constructor(id: string, field: string, query: Query) {
		super();
		this.query = query;
		this.field = field;
		this.idString = id;
	}

	public static makeKey(k: string, query: Query): Key {
		Key.isValidKey(k);
		const idString = Key.getIdString(k);
		const field = Key.getField(k);
		Key.isValidIdString(idString, query);
		Key.isValidField(field);
		if (Key.isMField(field)) {
			return new MKey(k, query);
		} else {
			return new SKey(k, query);
		}
	}

	protected static isValidKey(k: string) {
		if (!Key.validKey.test(k)) {
			throw new InsightError("key '" + k + "' is invalid");
		}
	}

	protected static getIdString(k: string) {
		return k.split("_")[0];
	}

	protected static getField(k: string) {
		return k.split("_")[1];
	}

	protected static isValidField(field: string) {
		if (!(Key.roomMField.test(field) || Key.roomSField.test(field) ||
			Key.courseMField.test(field) || this.courseSField.test(field))) {
			throw new InsightError("field '" + field + "' is invalid");
		}
	}

	protected static isValidIdString(idString: string, query: Query) {
		if (query.idString === "") {
			query.idString = idString;
		} else {
			if (query.idString !== idString) {
				throw new InsightError("cannot query more than one kind of dataset");
			}
		}
	}

	public static isMField(field: string) {
		return (Key.courseMField.test(field) || Key.roomMField.test(field));
	}

	private static isSField(field: string) {
		return (Key.courseSField.test(field) || Key.roomSField.test(field));
	}

	// private static courseField = /(dept)|(id)|(instructor)|(title)|(uuid)|(avg)|(pass)|(fail)|(audit)|(year)/;
	// private static roomField = new RegExp(["(fullname)|(shortname)|(number)|(name)|(address)|(type)|(furniture)|(href)",
	// 	"|(lat) | (lon) | (seats)"].join(""))
	// private static setIdstring(key: string): string {
	// 	if (!Key.validKey.test(key)) {
	// 		throw new InsightError("key '" + key + "' is invalid");
	// 	}
	// 	return key.split("_")[0];
	// }
	// protected abstract setField(k: string): string;
	// private setDataInfo() {
	// 	// let field = this.field;
	// 	// let kind: InsightDatasetKind;
	// 	// if (Key.courseField.test(field)) {
	// 	// 	kind = InsightDatasetKind.Courses;
	// 	// } else if (Key.roomField.test(field)) {
	// 	// 	kind = InsightDatasetKind.Rooms;
	// 	// } else {
	// 	// 	throw new InsightError("field '" + field + "' is invalid");
	// 	// }
	//
	// 	if (this.query.idString === "") {
	// 		// Query.dataInfo.kind = kind;
	// 		this.query.idString = this.idString;
	// 	} else {
	// 		// if (!((Query.dataInfo.kind === kind) && (Query.dataInfo.idString === this.idString))) {
	// 		if (this.query.idString !== this.idString) {
	// 			throw new InsightError("cannot query more than one kind of dataset");
	// 		}
	// 	}
	// }
}

export class SKey extends Key{
	constructor(k: string, q: Query) {
		Key.isValidKey(k);
		const idString = Key.getIdString(k);
		const field = Key.getField(k);
		Key.isValidIdString(idString, q);
		SKey.isValidSField(field);
		super(idString, field, q);
	}

	private static isValidSField(f: string) {
		if (!(Key.courseSField.test(f) || Key.roomSField.test(f))) {
			throw new InsightError("field '" + f + "' is invalid S Field");
		}
	}
}

export class MKey extends Key {
	constructor(k: string, q: Query) {
		Key.isValidKey(k);
		const idString = Key.getIdString(k);
		const field = Key.getField(k);
		Key.isValidIdString(idString, q);
		MKey.isValidMField(field);
		super(idString, field, q);
	}

	private static isValidMField(f: string) {
		if (!(Key.courseMField.test(f) || Key.roomMField.test(f))) {
			throw new InsightError("field '" + f + "' is invalid M Field");
		}
	}
}

export class ApplyKey {
	public applyKey: string;

	public constructor(k: string) {
		this.applyKey = k;
	}
}
