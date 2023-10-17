import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import JSZip from "jszip";
import parse5 from "parse5";
import fs, {existsSync} from "fs";
import http from "http";

const NUMBERCODE = "views-field views-field-field-room-number";
const SEATCODE = "views-field views-field-field-room-capacity";
const FURNITURECODE = "views-field views-field-field-room-furniture";
const TYPECODE = "views-field views-field-field-room-type";
const FULLNAMECODE = "views-field views-field-title";
const ADDRESSCODE = "views-field views-field-field-building-address";
const SHORTNAMECODE = "views-field views-field-field-building-code";
const TBODY = "tbody";
const TD = "td";
const TR = "tr";
const HTTPREQUEST = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team<129>/";
let buildingShortnameList: any = [];
let buildingMap = new Map<string, any>();

export function getRoomsPromise(id: string, content: string, kind: InsightDatasetKind,
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
				.then((zipFile) => {
					try{
						if(zipFile.files["rooms/"].name !== "rooms/") {
							return reject(new InsightError(["processing zip file error"]));
						}
					}catch {
						return reject(new InsightError(["processing zip file error"]));
					}
					zipFile.file("rooms/index.htm")?.async("string").then((index: string) => {
						return getBuildingList(parse5.parse(index));
					}).then((buildingList) =>{
						return addGeoInfo(buildingList);
					}).then((buildings) => {
						let fileResolvePromises: Array<Promise<any>> = [];
						for (let filename in zipFile.files) {
							if (filename !== "index.htm" && zipFile.file(filename) != null) {
								const file = zipFile.file(filename);
								if(file) {
									fileResolvePromises.push(file.async("string"));
								}
							}
						}
						outputDataFile(fileResolvePromises, buildings, id, kind, ids, insightDatasets, resolve, reject);
					}).catch(() => {
						return reject(new InsightError(["processing zip file error"]));
					});
				}).catch(() => {
					return reject(new InsightError(["processing zip file error"]));
				});
		} catch (err) {
			return reject(new InsightError(["JSZIP load error"]));
		}
	});
}

function assignData(id: string, kind: InsightDatasetKind, ids: string[], insightDatasets: any[], rooms: any[]) {
	let numRows = rooms.length;
	const insightData: InsightDataset = {
		id,
		kind,
		numRows,
	};
	ids.push(id);
	insightDatasets.push(insightData);
}

function outputDataFile(fileResolvePromises: Array<Promise<any>>,
	buildings: any, id: string, kind: InsightDatasetKind,
	ids: string[], insightDatasets: any[],
	resolve: (value: (PromiseLike<string[]> | string[])) => void, reject: (reason?: any) => void) {
	Promise.all(fileResolvePromises).then((files: string[]) => {
		createBuildingListAndMap(buildings);
		let roomNodes: any = [];
		let rooms: any[] = [];
		rooms = generateRooms(getRoomList(getRoomNodes(files, roomNodes)), rooms);
		if (rooms.length === 0) {
			throw new InsightError([]);
		}
		assignData(id, kind, ids, insightDatasets, rooms);
		fs.writeFileSync("data/" + id + ".json", JSON.stringify(rooms));
		if(insightDatasets.length !== 0) {
			if(!existsSync("metaData")) {
				fs.mkdirSync("metaData");
			}
			fs.writeFileSync("metaData/" + "datasets" + ".json",JSON.stringify(insightDatasets));
		}
		return resolve(ids);
	}).catch(() => {
		return reject(new InsightError(["file processing error"]));
	});
}

function getRoomNodes(files: string[], roomNodes: any) {
	for (let file of files) {
		roomNodes = roomNodes.concat(getNodeList(parse5.parse(file), TBODY));
	}
	return roomNodes;
}


function createBuildingListAndMap(buildings: any []): void{
	for (let building of buildings) {
		buildingMap.set(building.shortname,building);
		buildingShortnameList.push(building.shortname);
	}
}

function getBuildingList(document: any): any {
	let nodeList = getNodeList(document, TBODY);
	let buildings: any = [];
	for (let node of nodeList) {
		for (let child of node.childNodes) {
			if (child.nodeName === TR) {
				let fullname: string = "";
				let address: string = "";
				let shortname: string = "";
				for (let element of child.childNodes) {
					if (fullname && address && shortname) {
						break;
					}
					if (element.nodeName === TD) {
						let value = element.attrs[0].value;
						if (ADDRESSCODE === value) {
							address = element.childNodes[0].value.trim();
						}
						if (SHORTNAMECODE === value) {
							shortname = element.childNodes[0].value.trim();
						}
						if (FULLNAMECODE === value) {
							for (let attr of element.childNodes) {
								if (attr.nodeName === "a") {
									fullname = attr.childNodes[0].value;
									break;
								}
							}
						}

					}
				}
				buildings.push({fullname: fullname, address: address, shortname: shortname});
			}
		}
		return buildings;
	}
}

function addGeoInfo(buildingList: any): Promise<any> {
	let buildingPromises: any[] = [];
	for (let building of buildingList) {
		buildingPromises.push(getLocation(building));
	}
	return Promise.all(buildingPromises);
}

function getLocation(building: any) {
	return new Promise(function (resolve, reject) {
		const request = HTTPREQUEST + building.address.replace(/ /g, "%20");
		http.get(request, function (response: any) {
			response.setEncoding("utf8");
			let coordinate = "";
			response.on("data", (latAndLon: string) => coordinate += latAndLon);
			response.on("end", ()=> {
				try {
					let geoResponse = JSON.parse(coordinate);
					if (!geoResponse.error) {
						resolve({
							fullname: building.fullname, address: building.address, shortname: building.shortname,
							lat: geoResponse.lat, lon: geoResponse.lon
						});
					} else {
						return reject(new InsightError([]));
					}
				} catch (e) {
					return reject(new InsightError(["get location resolving error"]));
				}
			});
		});
	});
}

function getNodeList(document: any, tag: string): any[]{
	let nodes = [];
	if (document.tagName === tag) {
		nodes.push(document);
	}
	if (Object.keys(document).includes("childNodes")) {
		for (let node of document.childNodes) {
			let childrenList: any = getNodeList(node, tag);
			nodes = nodes.concat(childrenList);
		}
	}
	return nodes;
}

function generateRooms(roomList: any, rooms: any): any[]{
	for (let room of roomList) {
		let roomShortName = room.href.substring(room.href.lastIndexOf("/") + 1, room.href.lastIndexOf("-"));
		if (buildingShortnameList.includes(roomShortName)) {
			let building = buildingMap.get(roomShortName);
			rooms.push(new Room(building.fullname, building.shortname, room.number,
				building.shortname + "_" + room.number, building.address,
				building.lat, building.lon, parseInt(room.seats, 10), room.type, room.furniture, room.href));
		}
	}
	return rooms;
}

function getRoomList(roomNodes: any): any {
	let roomList: Array<{number: string, seats: string, type: string, furniture: string, href: string}> = [];
	if (roomNodes.length !== 0) {
		for (let node of roomNodes) {
			for (let child of node.childNodes) {
				if (child.nodeName === TR) {
					let number: string = "";
					let seats: string = "";
					let type: string = "";
					let furniture: string = "";
					let href: string = "";
					for (let c of child.childNodes) {
						if (c.nodeName === TD) {
							let value = c.attrs[0].value;
							if (value === NUMBERCODE) {
								for (let attr of c.childNodes) {
									if (attr.nodeName === "a") {
										href = attr.attrs[0].value;
										number = attr.childNodes[0].value;
										break;
									}
								}
							}
							if (SEATCODE === value) {
								seats = c.childNodes[0].value.trim();
							}
							if (TYPECODE === value) {
								type = c.childNodes[0].value.trim();
							}
							if (FURNITURECODE === value) {
								furniture = c.childNodes[0].value.trim();
							}
						}
					}
					roomList.push({
						number: number,
						seats: seats,
						type: type,
						furniture: furniture,
						href: href
					});
				}
			}
		}
		return roomList;
	}
}

export class Room {
	private fullname: string;
	private shortname: string;
	private number: string;
	private name: string;
	private address: string;
	private lat: number;
	private lon: number;
	private seats: number;
	private roomType: string;
	private furniture: string;
	private href: string;
	constructor(fullname: string, shortname: string,
		number: string, name: string,
		address: string, lat: number, lon: number,
		seats: number, roomType: string, furniture: string,
		href: string) {
		this.fullname = fullname;
		this.shortname = shortname;
		this.number = number;
		this.name = name;
		this.address = address;
		this.lat = lat;
		this.lon = lon;
		this.seats = seats;
		this.roomType = roomType;
		this.furniture = furniture;
		this.href = href;
	}
}
