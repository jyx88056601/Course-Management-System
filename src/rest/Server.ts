import express, {Application, Request, Response} from "express";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import {InsightDatasetKind, InsightError, NotFoundError} from "../controller/IInsightFacade";
import fs, {existsSync} from "fs";

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;
	private insightFacade: InsightFacade;

	constructor(port: number) {
		console.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();

		this.registerMiddleware();
		this.registerRoutes();
		this.insightFacade = new InsightFacade();
		if(existsSync("metaData/datasets.json")) {
			this.insightFacade.insightDatasets
				= JSON.parse(fs.readFileSync("metaData/datasets.json").toString());
		}
		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		this.express.use(express.static("./frontend/public"));
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.info("Server::start() - start");
			if (this.server !== undefined) {
				console.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express.listen(this.port, () => {
					console.info(`Server::start() - server listening on port: ${this.port}`);
					resolve();
				}).on("error", (err: Error) => {
					// catches errors in server start
					console.error(`Server::start() - server ERROR: ${err.message}`);
					reject(err);
				});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public stop(): Promise<void> {
		console.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				console.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					console.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware() {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({type: "application/*", limit: "10mb"}));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
		this.express.set("view engine", "ejs");
	}

	// Registers all request handlers to routes
	private registerRoutes() {
		this.registerPutRoute();
		this.registerDeleteRoute();
		this.registerPostRoute();
		this.registerGetRoute();
		this.express.get("/homepage", (req, res)=> {
			res.render("home");
		});
	}

	private registerGetRoute() {
		this.express.get("/datasets", ((req, res) => {
			this.insightFacade.listDatasets().then((arr) => {
				res.status(200).json({res: arr});
			}).catch((err)=>{
				res.status(400).json({error: err.message});
			});
		}));
	}

	private registerPostRoute() {
		this.express.post("/query", (req, res) => {
			console.log("performQuery");
			console.dir(req.body);
			this.insightFacade.performQuery(req.body)
				.then((arr) => {
					res.status(200).json({res: arr});
				}).catch((err) => {
					res.status(400).json({err: err.message});
				});
		});
	}

	private registerDeleteRoute() {
		this.express.delete("/dataset/:id", ((req, res) => {
			const id = req.params.id;
			this.insightFacade.removeDataset(id).then((arr) => {
				res.status(200).json({res: arr});
			}).catch((err)=>{
				if (err instanceof NotFoundError) {
					res.status(404).json({error: err.message});
				}
				if (err instanceof InsightError) {
					res.status(400).json({error: err.message});
				}
			});
		}));
	}

	private registerPutRoute() {
		this.express.put("/dataset/:id/:kind", (req, res) => {
			const id = req.params.id;
			let content = req.body.toString("base64");
			const kind = req.params.kind;

			if (kind === InsightDatasetKind.Rooms) {
				this.insightFacade.addDataset(id, content, InsightDatasetKind.Rooms).then((arr) => {
					res.status(200).json({result: arr});
				}).catch((err) => {
					res.status(400).json({error: err.message});
				});
			} else if (kind === InsightDatasetKind.Courses) {
				this.insightFacade.addDataset(id, content, InsightDatasetKind.Courses).then((arr) => {
					res.status(200).json({result: arr});
				}).catch((err) => {
					res.status(400).json({error: err.message});
				});
			} else {
				res.status(400).json({error: "type can only be 'rooms' or 'courses'"});
			}
		});
	}

// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response) {
		try {
			console.log(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(200).json({result: response});
		} catch (err) {
			res.status(400).json({error: err});
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}
}
