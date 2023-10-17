// selectors
const shortnameInput = document.querySelector("#inputShortName");
const submitBtn = document.querySelector("#submit");
const mainContainer = document.querySelector("#mainContainer");
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
		let info = {
			shortname: response.data.res[0].rooms_shortname,
			fullname: response.data.res[0].rooms_fullname,
			address: response.data.res[0].rooms_address
		};
		addInfo(info);
	} catch (e) {
		showError();
	}
}

function addInfo(info) {
	let shortname = info.shortname;
	let fullname = info.fullname;
	let address = info.address;

	const infoTable = document.createElement("table");
	infoTable.classList.add("table");
	infoTable.id = "infoTable";
	const tableHead = document.createElement("thead");
	const col1 = document.createElement("th");
	col1.innerText = "Short Name";
	const col2 = document.createElement("th");
	col2.innerText = "Full Name";
	const col3 = document.createElement("th");
	col3.innerText = "Address Name";
	const tableBody = document.createElement("tbody");
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

function makeQuery(shortname) {
	let input = shortname.toUpperCase();
	return newQuery = {
		WHERE: {
			IS: { rooms_shortname: input }
		},
		OPTIONS: {
			COLUMNS: [
				"rooms_shortname",
				"rooms_fullname",
				"rooms_address"
			]
		},
		TRANSFORMATIONS: {
			GROUP: ["rooms_shortname", "rooms_fullname", "rooms_address"],
			APPLY: []
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
