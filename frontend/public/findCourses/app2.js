// selectors
const shortnameInput = document.querySelector("#inputShortName");
const submitBtn = document.querySelector("#submit");
const checkBox = document.querySelector("#checkbox");
const resultContainer = document.querySelector("#resultContainer");

// event listener
submitBtn.addEventListener('click', displayResult);

// Functions
async function displayResult(event) {
	event.preventDefault();
	while (resultContainer.firstChild) {
		resultContainer.removeChild(resultContainer.firstChild);
	}
	let newQuery = makeQuery(shortnameInput.value);
	try {
		console.log("ready to make request")
		const response = await axios.post("http://localhost:4321/query", newQuery);
		if (response.data.res.length === 0) {
			showError();
			return;
		}
		addInfo(response.data.res);
	} catch (e) {
		showError();
	}
}

function addInfo(result) {
	const infoTable = document.createElement("table");
	infoTable.classList.add("table");
	infoTable.id = "infoTable";
	const tableHead = document.createElement("thead");
	const col1 = document.createElement("th");
	col1.innerText = "Course";
	const col2 = document.createElement("th");
	col2.innerText = "Number";
	const col3 = document.createElement("th");
	col3.innerText = "Average grade";
	const tableBody = document.createElement("tbody");
	for(let info of result) {
		let shortname = info.courses_dept;
		let fullname = info.courses_id;
		let address = info.avgAVG;
		const row = document.createElement("tr");
		const sn = document.createElement("td");
		sn.innerText = shortname;
		const fn = document.createElement("td");
		fn.innerText = fullname;
		const adrs = document.createElement("td");
		adrs.innerText = address;
		console.log("added contents")
		tableHead.appendChild(col1);
		tableHead.appendChild(col2);
		tableHead.appendChild(col3);
		infoTable.appendChild(tableHead);
		row.appendChild(sn);
		row.appendChild(fn);
		row.appendChild(adrs);
		tableBody.appendChild(row);
		infoTable.appendChild(tableBody);
		resultContainer.appendChild(infoTable);
	}
}

function makeQuery(shortname) {
	let order = "UP";
	let keys = "courses_id" ;
	if(checkBox.checked) {
		order = "DOWN";
		keys = "avgAVG";
	}
	let input = shortname.toLowerCase();
	return newQuery = {
		"WHERE": {
			"IS": {
				"courses_dept": input
			}
		},
		"OPTIONS": {
			"COLUMNS": [
				"courses_dept",
				"courses_id",
				"avgAVG"
			],
			"ORDER": {
				"dir": order,
				"keys": [
					keys
				]
			}
		},
		"TRANSFORMATIONS": {
			"GROUP": [
				"courses_dept",
				"courses_id"
			],
			"APPLY": [
				{
					"avgAVG": {
						"AVG": "courses_avg"
					}
				}
			]
		}
	};
}

function showError() {
	const error = document.createElement('div');
	error.id = "error";
	error.classList.add("alert", "alert-danger");
	error.role = "alert";
	error.innerText = `Can not find ${shortnameInput.value}`;
	resultContainer.appendChild(error);
}
