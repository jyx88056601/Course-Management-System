import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import {getCoursesPromise} from "./getCoursesPromise";
import {getRoomsPromise} from "./getRoomsPromise";
import {performQuery} from "./queryEngine/Query";
import * as fs from "fs";
import {existsSync} from "fs";
/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	public insightDatasets: InsightDataset[] = [];
	private ids:  string [] = [];

	public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// if directory does not exist, then create it
		if(!existsSync("data")) {
			fs.mkdirSync("data");
		}
		if(kind === InsightDatasetKind.Courses) {
			return getCoursesPromise(id, content, kind, this.ids, this.insightDatasets);
		}
		return getRoomsPromise(id, content, kind, this.ids, this.insightDatasets);
	}


	public removeDataset(id: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (id === " " || id.indexOf("_") !== -1 || id === "\t") {
				return reject(new InsightError(["invalid id"]));
			}
			for (let i in this.insightDatasets) {
				if (this.insightDatasets[i].id === id) {
					this.insightDatasets.splice(this.insightDatasets.indexOf(this.insightDatasets[i]), 1);
					this.ids.splice(this.ids.indexOf(id), 1);
					const filePath = "./data/" + id + ".json";
					fs.unlinkSync(filePath);
					if(this.insightDatasets.length !== 0) {
						if(!existsSync("metaData")) {
							fs.mkdirSync("metaData");
						}
						fs.writeFileSync("metaData/" + "datasets" + ".json",JSON.stringify(this.insightDatasets));
					}
					return resolve(id);
				}
			}
			return reject(new NotFoundError(["cannot remove data with input id"]));
		});
	}

	// How to read json file, for example
	// const data = fs.readFileSync('course.json');
	// console.log(JSON.parse(data.toString()));
	public performQuery(query: any): Promise<any[]> {
		return new Promise((resolve, reject) => {
			resolve(performQuery(query));
		});
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return new Promise<InsightDataset[]>((resolve) => {
			resolve(this.insightDatasets);
		});
	}
}
