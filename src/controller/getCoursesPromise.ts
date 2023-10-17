import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import JSZip from "jszip";
import fs, {existsSync} from "fs";

let courseMap = new Map<string, SingleSession []>();
export function getCoursesPromise(id: string, content: string, kind: InsightDatasetKind,
	ids: string [], insightDatasets: any []): Promise<string[]> {
	return new Promise((resolve, reject) => {
		try {
			if (id.indexOf("_") !== -1 || id === " " || id === "\t") {
				return reject(new InsightError(["invalid id"]));
			}
			for (let eachData of insightDatasets) {
				if (eachData.id === id) {
					return reject(new InsightError(["id already existed"]));
				}
			}
			return new JSZip().loadAsync(content, {base64: true})
				.then( (zipFile) => {
					let keys = Object.keys(zipFile.files);
					let asyncReadPromises: Array<Promise<string>> = [];
					for (const key of keys) {
						asyncReadPromises.push(zipFile.files[key].async("string"));
					}
					return readAllFiles(asyncReadPromises, id, kind, insightDatasets).then(()=>{
						ids.push(id);
						resolve(ids);
					}).catch(()=>{
						return reject(new InsightError(["file promises resolving error"]));
					});
				}).catch(() => {
					return reject(new InsightError(["zip file processing error"]));
				});
		} catch (error) {
			return reject(new InsightError(["JSZIP loading error"]));
		}
	});
}

function readAllFiles(
	asyncReadPromises: Array<Promise<string>>, id: string, kind: InsightDatasetKind, insightDatasets: any []) {
	return Promise.all(asyncReadPromises).then((fileContents) => {
		let numRows = 0;
		let courses: SingleSession [] = [];
		for (const eachFileContent of fileContents) {
			if (eachFileContent !== "") {
				let JsonObj = JSON.parse(eachFileContent);
				for (const section of JsonObj.result) {
					let singleSession = new SingleSession(String(section.Subject),
						String(section.Course), Number(section.Avg),
						String(section.Professor), String(section.Title),
						Number(section.Pass), Number(section.Fail), Number(section.Audit),
						String(section.id), Number(section.Year));
					if(String(section.Section) === "overall") {
						singleSession.year = Number(1900);
					}
					courses.push(singleSession);
					courseMap.set(id + "_" + String(section.Subject) + String(section.Course), courses);
					numRows++;
				}
			}
		}
		const insightData: InsightDataset = {
			id,
			kind,
			numRows,
		};
		fs.writeFileSync("data/" + id + ".json",JSON.stringify(courses));
		insightDatasets.push(insightData);
		if(insightDatasets.length !== 0) {
			if(!existsSync("metaData")) {
				fs.mkdirSync("metaData");
			}
			fs.writeFileSync("metaData/" + "datasets" + ".json",JSON.stringify(insightDatasets));
		}
	});
}

export class SingleSession {
	public dept: string;
	public id: string;
	public avg: number;
	public instructor: string;
	public title: string;
	public pass: number;
	public fail: number;
	public audit: number;
	public uuid: string;
	public year: number;

	constructor(dept: string, id: string, avg: number, instructor: string, title: string,
		pass: number, fail: number, audit: number, uuid: string, year: number) {
		this.dept = dept;
		this.id = id;
		this.avg = avg;
		this.instructor = instructor;
		this.title = title;
		this.pass = pass;
		this.fail = fail;
		this.audit = audit;
		this.uuid = uuid;
		this.year = year;
	}
}
