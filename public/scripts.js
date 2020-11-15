
//{ #region variables for storage and configuration

//define variables for storage and configuration
//all accounts are stored in an array
var data;
//now some configs
//keep user-given password encrypted in memory. It will never be stored or shown anywhere in plain. 
var masterPasswordEncrypted;
//master password is encrypted with a temporary password. This will be renewed on each page load.
//I am full aware that this is not a full protection. However it helps against simple logging mechanisms. When you leave the browser unattended, then it's your fault. 
var tempPassword;
//SHA256 hash of the password
var masterPasswordHash;
//the master password will be appended to get some more security against brute force.
//this realm is defined in config. To get this realm, one must provide the correct password in the first place.  
var masterRealm;
//default length of passwords
var passwordSuggestionLength;
//which types of characters will be suggested by default?
var passwordSuggestionDefaults;
//which categories are defines in config?
var categoriesConfig;
//which subcategories are defined in config?
var subCategoriesConfig;
//inactivity time before automatic logout
var pageInactivityTimeout;
//should the subcategory Emojis be shown in tree view?
var showSubCategorieIconsInTreeview;
//when was last activity
var lastActivityTimestamp=Date.now();

//} #endregion variables for storage and configuration


//{ #region startup and events

//register events right when document is loaded.
document.addEventListener('DOMContentLoaded', registerEvents);


//called several times to register user interface events
function registerEvents()
{
	document.addEventListener('focus',checkPageInactivity);
	document.addEventListener('click',updateLastActivityTimestamp);
	document.addEventListener('keydown',updateLastActivityTimestamp);
	document.addEventListener('scroll',updateLastActivityTimestamp);
	
	gEbID('loginForm').addEventListener('submit', function(){event.preventDefault();});
	gEbID('newOrChangeForm').addEventListener('submit', function(){event.preventDefault();});
	gEbID('loginButton').addEventListener('click', login);
	gEbID('saveButton').addEventListener('click', addOrUpdateJSONdataRow);
	gEbID('deleteButton').addEventListener('click', deleteJSONrow);
	gEbID('cancelButton').addEventListener('click', resetNewOrChangeForm);
	gEbID('searchField').addEventListener('keyup', searchTable);
	if(gEbID('tableHeader')!=null) gEbID('tableHeader').addEventListener('click', sortTable);
	gEbID('newAccount').addEventListener('click', prepareNewAccountForm);
	gEbID('copyLoginFromForm').addEventListener('click', copyDataFromForm);
	gEbID('copyPasswordFromForm').addEventListener('click', copyDataFromForm);
	gEbID('openChangePasswordForm').addEventListener('click', openChangePasswordForm);
	gEbID('newMasterPassword').addEventListener('keyup', showNewPasswordsHash);
	gEbID('changePasswordButton').addEventListener('click', changeMasterPassword);
	
	document.querySelectorAll('.newPasswordComplexitySwitch').forEach(element => element.addEventListener('change', function(){gEbID('newOrChangeForm_password').value = createPassword();}));
	document.querySelectorAll('.edit').forEach(element => element.addEventListener('click', fillChangeForm));
	document.querySelectorAll('.copyData').forEach(element => element.addEventListener('click', copyDataFromTable));
	document.querySelectorAll('.selectCategory').forEach(element => element.addEventListener('click', selectCategory));
	document.querySelectorAll('.selectSubCategory').forEach(element => element.addEventListener('click', selectSubCategory));

}
//} #endregion startup and events


//{ #region login, load config and account data, show table and tree

//called when login is clicked
//if everything works as expected, the following caller chain will be done to get decrypted account data:
//
//login() -> loadConfig() -> loadAccountData() -> decryptAccountData() -> drawHTMLtable() -> drawCategoryTree()
async function login()
{
	//if password field is empty, do nothing
	if(gEbID('masterPassword').value=="")
		return;
	
	//make a SHA256 hash of the given password
	masterPasswordHash=await sha256(gEbID('masterPassword').value);	
	console.log("you have to allow the following hash in config to be able to save the data: "+ masterPasswordHash);
	
	//make a query by ajax, if the hash of the password is allowed to do anything
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "ajax.php", true);
	xhttp.onreadystatechange = function() 
	{
		if (this.readyState == 4 && this.status == 200) 
		{
			//if the ajax response is "true" then the hash is allowed. 
			if(this.responseText =="true")
			{
				//go ahead load config and later the data
				loadConfig();
			}
		}
		
		//if the ajax response is not true, then do nothing
	};
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	//always deliver the hash of the password. If this is missing or wrong, the server will not talk to us.
	xhttp.send("do=check&hash="+masterPasswordHash); 
	
}

//called by login()
//second step of the caller chain
//login() -> loadConfig() -> loadAccountData() -> decryptAccountData() -> drawHTMLtable() -> drawCategoryTree()
function loadConfig()
{
	//make a query by ajax to get the configurations
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "ajax.php", true);
	xhttp.onreadystatechange = function() 
	{
		if (this.readyState == 4 && this.status == 200) 
		{
			//read the ajax response into an object
			var config=JSON.parse(this.responseText);
		
			//set the config to the global variables
			masterRealm=config["masterRealm"];
			passwordSuggestionLength=config["passwordSuggestionLength"];
			passwordSuggestionDefaults=config["passwordSuggestionDefaults"];
			categoriesConfig=config["categories"];
			subCategoriesConfig=config["subCategories"];
			pageInactivityTimeout=config["pageInactivityTimeout"];
			showSubCategorieIconsInTreeview=config["showSubCategorieIconsInTreeview"];
			
			var _option_ = document.createElement('option');
			//categories		
			for (const [description, picture] of Object.entries(config["categories"])) 
			{
				var option= _option_.cloneNode(false);
				option.value=description;
				option.text=picture+description;
				gEbID("newOrChangeForm_category").add(option);
			};
			//subcategories
			for (const [description, picture] of Object.entries(config["subCategories"])) 
			{
				var option= _option_.cloneNode(false);
				option.value=description;
				option.text=picture+description;
				gEbID("newOrChangeForm_subcategory").add(option);
			};
			
			//password defaults
			for (const [key, value] of Object.entries(config["passwordSuggestionDefaults"])) {
				gEbID("newPassword_"+key).checked=value;
			};
			
			//start the activity checker
			setInterval(checkPageInactivity, 1000);			
			//now load the data
			loadAccountData();
		}
	};
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	//always deliver the hash of the password. If this is missing or wrong, the server will not talk to us.
	xhttp.send("do=getConfig&hash="+masterPasswordHash); 
}



//third step of the caller chain
//login() -> loadConfig() -> loadAccountData() -> decryptAccountData() -> drawHTMLtable() -> drawCategoryTree()
async function loadAccountData()
{
	//master password will not be stored in plain. So create a temporary password for this session 
	tempPassword=createPassword();
	//encrypt master password with temporary session password
	masterPasswordEncrypted=await encryptData(masterRealm+gEbID('masterPassword').value,tempPassword);
	//clear password field
	gEbID('masterPassword').value="";	
	//hide login field
	gEbID('loginForm').style.display="none";
	
	
	//now get the encrypted account data from the server via ajax
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "ajax.php", true);
	xhttp.onreadystatechange = function() 
	{
		if (this.readyState == 4 && this.status == 200) 
		{
			//now we have encrypted accounts, we need to decrypt them
			decryptAccountData(decodeURIComponent(this.responseText));
		}
	};
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	//always deliver the hash of the password. If this is missing or wrong, the server will not talk to us.
	xhttp.send("do=load&hash="+masterPasswordHash); 
}

//forth step of the caller chain
//login() -> loadConfig() -> loadAccountData() -> decryptAccountData() -> drawHTMLtable() -> drawCategoryTree()
async function decryptAccountData(encryptedData)
{
	//if there is no encrypted data yet, start with a blank object
	if(encryptedData=="")
	{
		data=[];
	}else
	{
		//decrypt masterPassword for this operation
		var masterPassword=await decryptData(masterPasswordEncrypted,tempPassword);
		//https://github.com/bradyjoslin/webcrypto-example
		var decryptedData=await decryptData(encryptedData,masterPassword);
		//forget unencrypted master password
		masterPassword="";		
		//decrypted data is a JSON string. Make an object from it.
		data=JSON.parse(decryptedData);
	}
	
	//there may be gaps in the IDs, just set them new. They only have to be unique during the session.
	for (var i = 0; i < data.length; i++) 
	{
		data[i][0] = i;
	}

	//now show that to the user
	drawHTMLtable();
}

//fifths step of the caller chain
//login() -> loadConfig() -> loadAccountData() -> decryptAccountData() -> drawHTMLtable() -> drawCategoryTree()
function drawHTMLtable() 
{
	 
	//sort data by category and subcategory
	data.sort(sortByCategoryFunction());
	
	//prototypes for HTML elements.
	var _table_ = document.createElement('table'),
		_tr_ = document.createElement('tr'),
		_td_ = document.createElement('td'),
		_th_ = document.createElement('th'),
		_img_ = document.createElement('img'),
		_a_=document.createElement('a');
	
	
	//create table
    var table = _table_.cloneNode(false);
	table.setID='passwordTable';
    
	//create headline
	var tr = _tr_.cloneNode(false);
	tr.id="tableHeader";
	tr.title="click to sort";
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("action"));
	//add the cell to the row
	tr.appendChild(th);
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("description"));
	tr.appendChild(th);
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("category"));
	tr.appendChild(th);
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("subcategory"));
	tr.appendChild(th);
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("url"));
	th.classList.add("url");
	tr.appendChild(th);
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("login"));
	tr.appendChild(th);
	var th = _th_.cloneNode(false);
	th.appendChild(document.createTextNode("comment"));
	tr.appendChild(th);

	//add the row to the table
	table.appendChild(tr);
	
	//create data rows	 
	for (var i=0, maxi=data.length; i < maxi; ++i) 
	{
		var rowID=data[i][0];
		var tr = _tr_.cloneNode(false);

		tr.id="row_"+rowID;
		
		//action column
		var td = _td_.cloneNode(false);
		td.classList.add("actionColumn");

		var edit = _a_.cloneNode(false);
		edit.id="edit_"+rowID;
		edit.innerHTML="✏️";
		edit.title="edit entry";
		edit.classList.add("edit");
		td.appendChild(edit);

		var copyUrl = _a_.cloneNode(false);
		copyUrl.id="copy_"+rowID+"_url";
		copyUrl.title="copy url";
		copyUrl.innerHTML="🔗";
		copyUrl.classList.add("copyData");
		td.appendChild(copyUrl);
		
		var copyUser = _a_.cloneNode(false);
		copyUser.id="copy_"+rowID+"_login";
		copyUser.title="copy login";
		copyUser.innerHTML="🙋";
		copyUser.classList.add("copyData");
		td.appendChild(copyUser);

		var copyPassword = _a_.cloneNode(false);
		copyPassword.id="copy_"+rowID+"_password";
		copyPassword.title="copy password";
		copyPassword.innerHTML="🔑";
		copyPassword.classList.add("copyData");
		td.appendChild(copyPassword);
		tr.appendChild(td);

		//description
		var td = _td_.cloneNode(false);	
		td.appendChild(document.createTextNode(data[i][1] || ''));
		td.id="cell_"+rowID+"_description";
		tr.appendChild(td);

		//category
		var td = _td_.cloneNode(false);	
		td.appendChild(document.createTextNode(data[i][2] || ''));
		td.id="cell_"+rowID+"_category";	
		tr.appendChild(td);

		//subcategory
		var td = _td_.cloneNode(false);	
		td.appendChild(document.createTextNode(data[i][3] || ''));
		td.id="cell_"+rowID+"_subcategory";			
		tr.appendChild(td);

		//url
		var td = _td_.cloneNode(false);	
		if(data[i][4].startsWith("http"))
		{
			var a=_a_.cloneNode(false);				
			a.appendChild(document.createTextNode(data[i][4] || ''));
			a.href=data[i][4];
			a.style.cursor="pointer";
			a.setAttribute("rel", "noopener noreferrer");
			td.appendChild(a);
		}else
			td.appendChild(document.createTextNode(data[i][4] || ''));
		td.id="cell_"+rowID+"_url";	
		td.classList.add("url");
		tr.appendChild(td);
		
		//login
		var td = _td_.cloneNode(false);	
		td.appendChild(document.createTextNode(data[i][5] || ''));
		td.id="cell_"+rowID+"_login";			
		tr.appendChild(td);

		//comment
		var td = _td_.cloneNode(false);	
		td.appendChild(document.createTextNode(data[i][7] || ''));
		td.id="cell_"+rowID+"_comment";	
		tr.appendChild(td);

		tr.appendChild(td);

		table.appendChild(tr);
	}
	
	//output the table
	gEbID('passwordTable').innerHTML ="";
	gEbID('passwordTable').appendChild(table);

	//show number of accounts in searchfield
	gEbID('searchField').placeholder="search in "+data.length+" accounts";
	gEbID('searchField').value="";
	
	//show the elements
	gEbID('passwordTableContainer').style.display="inline-grid";
	gEbID('timeoutMessage').style.display="inherit";
	
	drawCategoryTree();
	registerEvents();
 }

//last step of the caller chain
//login() -> loadConfig() -> loadAccountData() -> decryptAccountData() -> drawHTMLtable() -> drawCategoryTree()
function drawCategoryTree()
{

	//get unique tupels of categories and sub categories, each category and subcategory should be shown once in the tree
	var uniqueCategories={};
	
	for (var i = 0; i < data.length; i++) 
	{
		var category=data[i][2];
		var subCategory=data[i][3];
		if(category in uniqueCategories == false)
		{
			//initialize
			uniqueCategories[category] = {}; 
		}
		//now we have an object with 2-dimensional key. This way, it will simply be unique
		uniqueCategories[category][subCategory]=0;
	}
	
	//prototypes of HTML elements.
	var _dl_=document.createElement("dl"),
		_dt_=document.createElement("dt"),
		_dd_=document.createElement("dd");
	
	var dl=_dl_.cloneNode(false);	
	_dt_.classList.add("selectCategory");
	_dd_.classList.add("selectSubCategory");
	
	var dt=_dt_.cloneNode(false);
	dt.ID="category_[!all!]";
	dt.innerText="🗀no filter";
	dl.appendChild(dt);
	
	//walk through the categories and show them 
	for (const [category, value] of Object.entries(uniqueCategories)) 
	{
		var dt=_dt_.cloneNode(false);
		dt.ID="category_"+category;
		dt.innerText=categoriesConfig[category]+category;
		dl.appendChild(dt);
		
		//walk through the subcategories of the current category and show them
		for (const [subCategory, value] of Object.entries(uniqueCategories[category])) 
		{
			var dd=_dd_.cloneNode(false);
			dd.ID="category_"+category+"_"+subCategory;
			if(showSubCategorieIconsInTreeview)
				dd.innerText=subCategoriesConfig[subCategory]+subCategory;
			else
				dd.innerText=categoriesConfig[category]+subCategory;
			dl.appendChild(dd);
		}
	};
	
	//output
	gEbID("categoryTree").innerHTML="<br/><b>filter</b>";
	gEbID("categoryTree").appendChild(dl);
}

//} #enregion login, load config and account data, show table and tree


//{ #region add new account or change existing account

//called by click on "new account"
function prepareNewAccountForm()
{

	//password defaults
	for (const [key, value] of Object.entries(passwordSuggestionDefaults)) {
		gEbID("newPassword_"+key).checked=value;
	};
	
	//suggest a password. lengths and possible characters are defined in config.
	gEbID('newOrChangeForm_password').value = createPassword();
	
	
	//show the form and hide the table
	gEbID('passwordTableContainer').style.display ="none";
	gEbID('deleteButton').style.display ="none";
	gEbID('newOrChangeForm').style.display = "inherit";
}


//called by click on the pencil emoji
function fillChangeForm()
{
	//get the JSON-ID of the current row
	var idToEdit=this.id.split("_")[1];

	//get the data of this row
	var rowToEdit=getJSONdataRow(idToEdit);

	//fill in form with the data
	gEbID('newOrChangeForm_id').value			=idToEdit;
	gEbID('newOrChangeForm_description').value	=rowToEdit[1];
	gEbID('newOrChangeForm_category').value		=rowToEdit[2];
	gEbID('newOrChangeForm_subcategory').value	=rowToEdit[3];
	gEbID('newOrChangeForm_url').value			=rowToEdit[4];
	gEbID('newOrChangeForm_login').value		=rowToEdit[5];
	gEbID('newOrChangeForm_password').value		=rowToEdit[6];
	gEbID('newOrChangeForm_comment').value		=rowToEdit[7];

	//show the form and hide the table
	gEbID('deleteButton').style.display ="inherit";
	gEbID('passwordTableContainer').style.display ="none";
	gEbID('newOrChangeForm').style.display = "inherit";
}


//called by click on cancel button
function resetNewOrChangeForm()
{
	//forget everything
	gEbID("newOrChangeForm_id").value="";
	gEbID("newOrChangeForm").reset();
	//show the table, hide the form
	gEbID('newOrChangeForm').style.display = "none";
	gEbID('deleteButton').style.display ="inherit";
	gEbID('passwordTableContainer').style.display = "inline-grid";
}

//called by click on save button
//this function manipulates the data object and then calls storeAccountData()
function addOrUpdateJSONdataRow()
{
	//default: new row, so go to the end.
	var rowToChange=data.length;
	var newRow=[];
	
	//only if necessary fields are filled
	if(!gEbID('newOrChangeForm').checkValidity())
		return;
	
	//if this is not a new but a changed row
	if(gEbID("newOrChangeForm_id").value!="")
	{
		//find the row in account data with the current ID
		for (var i = 0; i < data.length; i++) 
		{
			ID=parseInt(gEbID("newOrChangeForm_id").value);
			if (data[i][0] == ID)
			{
				//if the ID is found, keep that row number for later.
				rowToChange=i;
				newRow[0]=data[i][0];
				break;
			}
		}
	}else
	{
		//get highest ID of account data to add a new row after that
		var maxID=-1;
		for (var i = 0; i < data.length; i++) 
		{
			if(maxID<data[i][0]) maxID=data[i][0];
		}
		newRow[0]=maxID+1;
	}
	
	//set the values
	newRow[1]=gEbID('newOrChangeForm_description').value;
	newRow[2]=gEbID('newOrChangeForm_category').value;
	newRow[3]=gEbID('newOrChangeForm_subcategory').value;
	newRow[4]=gEbID('newOrChangeForm_url').value;
	newRow[5]=gEbID('newOrChangeForm_login').value;
	newRow[6]=gEbID('newOrChangeForm_password').value;
	newRow[7]=gEbID('newOrChangeForm_comment').value;
	
	//if changed row, overwrite the information, if new row, append it 
	data[rowToChange]=newRow;
	
	//reset form 
	gEbID("newOrChangeForm_id").value="";
	gEbID("newOrChangeForm").reset();
	gEbID('newOrChangeForm').style.display = "none";
	
	//draw HTML table with new data
	drawHTMLtable();
	//encrypt the changed data object and store this on the server
	storeAccountData();
}

//called by click on delete button
function deleteJSONrow()
{
	//new rows can not be deleted
	if(gEbID("newOrChangeForm_id").value=="")
		return;

	//ask for confirmation
	if(!confirm("for real now?"))
		return;

	//find the row with the selected ID
	for (var i = 0; i < data.length; i++) 
	{
		if (data[i][0] == gEbID("newOrChangeForm_id").value)
		{
			//delete row from object
			data.splice(i, 1);
		}
	}
	
	//rest the form
	gEbID("newOrChangeForm_id").value="";
	gEbID("newOrChangeForm").reset();
	gEbID('newOrChangeForm').style.display = "none";
	
	//draw HTML table with new data
	drawHTMLtable();
	//encrypt the changed data object and store this on the server
	storeAccountData();
}

//called by addOrUpdateJSONdataRow() as well as  deleteJSONrow()
//does the encryption in the browser.
//The server never sees unencrypted data
async function storeAccountData()
{
	//master password is never kept in plain. It is encrypted with a temporary session password
	//decrypt masterPassword first
	var masterPassword=await decryptData(masterPasswordEncrypted,tempPassword);
	
	//create JSON from the data object and encrypt it. 
	//encryption is done using the browser's crpyto API. 
	//https://github.com/bradyjoslin/webcrypto-example
	const encryptedData= await encryptData(JSON.stringify(data),masterPassword);
	//forget unencrypted password
	masterPassword="";
	
	//make ajax request
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "ajax.php", true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	
	xhttp.onreadystatechange = function() 
	{
		if (this.readyState == 4 && this.status == 200) 
		{
			//inform user of successfully saved data
			successMessage("Saved!");
		}
		else
		{
			//if there was no success
			//log the error in console
			console.log(this);
			//inform user of error.
			errorMessage("Error while saving! For details check console.");			
		}
	};
	
	//send the password hash together with the encrypted data. The server never sees unencrypted data
	xhttp.send("do=store&hash="+masterPasswordHash+"&data="+encodeURIComponent(encryptedData)); 
}

//} #endregion add new account or change existing account


//{ #region change master password, encrypt with new password

//called by click on the gear emoji
function openChangePasswordForm()
{
	//hide table, open the respective form
	gEbID('passwordTableContainer').style.display="none";
	gEbID('changePasswordForm').style.display="inherit";
}

//called on key-up event in "new master password" field
async function showNewPasswordsHash()
{
	//if there is no new master password given, show nothing
	if(gEbID('newMasterPassword').value=="")
	{
		gEbID('newMasterPasswordHash').innerHTML="";
		return;
	}
	
	//create the hash of the current new master password
	const newMasterPasswordHash= await sha256(gEbID('newMasterPassword').value);
	//show it to the user so that he/she is able to include it in the config. 
	gEbID('newMasterPasswordHash').innerHTML="⚠️⚠️⚠️Please add the following hash to your config <b>BEFORE CLICKING THE BUTTON!</b> "+newMasterPasswordHash;
	//enable the re-encrypt button. 
	gEbID("changePasswordButton").disabled=false;
}

//called by click on  re-encrypt button
async function changeMasterPassword()
{
	//decrypt masterPassword for this operation
	var currentMasterPassword=await decryptData(masterPasswordEncrypted,tempPassword);

	//check if original Masterpassword matches the entered master password
	if(currentMasterPassword!=(masterRealm+gEbID('originalMasterPassword').value))
	{
		//if not, forget unencrypted master password. It should not linger any longer.
		currentMasterPassword="";
		//inform the user 
		alert("wrong original master password");
	}
	else
	{
		//if original master password matches the entered old master password...
		//forget unencrypted master password. It is not needed anymore.
		currentMasterPassword="";
		//ask for confirmation. 
		if(!confirm("Did you add the shown hash to your config? Otherwise, the new password will not be used!"))
			return;
		//create the hash of the new master password and store it in the global variable
		masterPasswordHash=await sha256(gEbID('newMasterPassword').value);
		//encrypt the new master password with the temporary session password and store it in the global variable
		masterPasswordEncrypted=await encryptData(masterRealm+gEbID('newMasterPassword').value,tempPassword);
		//clear the text field with the new master password
		gEbID('newMasterPassword').value="";
		//now simply store the data again. This function will use the global variables. 
		//if the user did not include the new hash in the config, this will fail. 
		storeAccountData();
		//show the table again.
		gEbID('passwordTableContainer').style.display="inline-grid";
		gEbID('changePasswordForm').style.display="none";
	}
	
}

//} #endregion change master password, encrypt with new password


//{ #region inactivity logout logic
//called by focus, click, keydown, scroll.
function updateLastActivityTimestamp()
{
	lastActivityTimestamp=Date.now();
}

//called every second. If last activity (focus, click, keydown, scroll) was before the defined time, data is deleted and page is reloaded
function checkPageInactivity()
{
	//before load of config, use sane default
	if(pageInactivityTimeout==undefined)
		pageInactivityTimeout=60;
	
	if(lastActivityTimestamp+(pageInactivityTimeout * 1000)<Date.now())
	{
		//clear account data
		data=[];
		masterPasswordEncrypted="";
		tempPassword="";
		window.location.reload();
	}
	//show remaining time until logout
	var milliSeconds=lastActivityTimestamp+(pageInactivityTimeout * 1000)-Date.now();
	gEbID("timeoutMessage").innerText = new Date(milliSeconds).toISOString().substr(11, 8).replace(/^[0:]+/, "")+" until logout" ;
}

//} #endregion inactivity logout logic


//{ #region GUI helper functions

//called by click on emojis in table
//copies eighter login, password, or URL to the clipboard
function copyDataFromTable()
{
	//check, what was clicked by HTML element's ID
	var clickedElement=this.id.split("_");
	//ID is the second part of HTML element's ID
	var ID=clickedElement[1];
	
	//what to be copied is the third part of HTML element's ID
	var whatToCopy=4;
	if(clickedElement[2]=="login")
		whatToCopy=5;
	if(clickedElement[2]=="password")
		whatToCopy=6;
	
	//workaround to circumvent browser security. 
	//We create an HTML-Form element, fill it with the requested data and copy that. 
	//this is as insecure as anything else but at least it is working.
	var dataToCopy=document.createElement('input');
	
	//get account data for requested ID and write it in our html form element
	dataToCopy.value=getJSONdataRow(ID)[whatToCopy];
	document.body.appendChild(dataToCopy);
	dataToCopy.select();
	dataToCopy.setSelectionRange(0, 99999);
	
	//copy and inform user
	if(document.execCommand("copy"))
		successMessage("copied!");
	else
		errorMessage("not copied!");
	
	//tidy up
	document.body.removeChild(dataToCopy);
}

//called by click on emojis in new account form
//copies eighter login or password to the clipboard
function copyDataFromForm()
{
	//check which one of those emojis was clicked
	var dataToCopy;
	if(this.id=='copyLoginFromForm')
		dataToCopy=gEbID('newOrChangeForm_login');
	else
		dataToCopy=gEbID('newOrChangeForm_password');
	
	//select text field content
	dataToCopy.select();
	dataToCopy.setSelectionRange(0, 99999);
	
	//copy and inform user
	if(document.execCommand("copy"))
		successMessage("copied!");
	else
		errorMessage("not copied!");
}

//called on key-up in search text field
function searchTable() 
{
	document.querySelectorAll('.selectCategory').forEach(element =>  element.style.fontWeight="");
	document.querySelectorAll('.selectSubCategory').forEach(element => element.style.fontWeight="");
    var input, filter, found, table, tr, td, i, j;
    input = document.getElementById("searchField");
    filter = input.value.toUpperCase();
    table = document.getElementById("passwordTable").firstChild;
    tr = table.getElementsByTagName("tr");
    for (i = 1; i < tr.length; i++) {
        td = tr[i].getElementsByTagName("td");
        for (j = 0; j < td.length; j++) {
            if (td[j].innerHTML.toUpperCase().indexOf(filter) > -1) {
                found = true;
            }
        }
        if (found) {
            tr[i].style.display = "";
            found = false;
        } else {
            tr[i].style.display = "none";
        }
    }
}

//called on click on table header
function sortTable(e) 
{
  var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
  table = document.getElementById("passwordTable").firstChild;
  table.style.display="none";
  var n = 0;
  
  var target=e.target;
  
  while( (target = target.previousSibling) != null )
	n++;



  switching = true;
  // Set the sorting direction to ascending:
  dir = "asc";
  /* Make a loop that will continue until
  no switching has been done: */
  while (switching) {
    // Start by saying: no switching is done:
    switching = false;
    rows = table.rows;
    /* Loop through all table rows (except the
    first, which contains table headers): */
    for (i = 1; i < (rows.length - 1); i++) {
      // Start by saying there should be no switching:
      shouldSwitch = false;
      /* Get the two elements you want to compare,
      one from current row and one from the next: */
      x = rows[i].getElementsByTagName("TD")[n];
      y = rows[i + 1].getElementsByTagName("TD")[n];
      /* Check if the two rows should switch place,
      based on the direction, asc or desc: */
      if (dir == "asc") {
        if (x.innerText.toLowerCase() > y.innerText.toLowerCase()) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir == "desc") {
        if (x.innerText.toLowerCase() < y.innerText.toLowerCase()) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      /* If a switch has been marked, make the switch
      and mark that a switch has been done: */
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      // Each time a switch is done, increase this count by 1:
      switchcount ++;
    } else {
      /* If no switching has been done AND the direction is "asc",
      set the direction to "desc" and run the while loop again. */
      if (switchcount == 0 && dir == "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
   table.style.display="inherit";
}



//called on click on category in tree
function selectCategory()
{
	var category=this.ID.split("_")[1];
	
	document.querySelectorAll('.selectCategory').forEach(element =>  element.style.fontWeight="");
	document.querySelectorAll('.selectSubCategory').forEach(element => element.style.fontWeight="");
	gEbID('searchField').value="";
	this.style.fontWeight="bold";
	
	table = document.getElementById("passwordTable").firstChild;
	tr = table.getElementsByTagName("tr");
	for (i = 1; i < tr.length; i++) 
	{
		td = tr[i].getElementsByTagName("td");

		if (td[2].innerText==category||category=="[!all!]")
		{
			tr[i].style.display = "";
			found = false;
		} else {
			tr[i].style.display = "none";
		}
	}
}

//called on click on subcategory in tree
function selectSubCategory()
{
	var category=this.ID.split("_")[1];
	var subCategory=this.ID.split("_")[2];

	document.querySelectorAll('.selectCategory').forEach(element =>  element.style.fontWeight="");
	document.querySelectorAll('.selectSubCategory').forEach(element => element.style.fontWeight="");
	gEbID('searchField').value="";
	this.style.fontWeight="bold";


	table = document.getElementById("passwordTable").firstChild;
	tr = table.getElementsByTagName("tr");
	for (i = 1; i < tr.length; i++) 
	{
		td = tr[i].getElementsByTagName("td");

		if (td[2].innerText==category&&td[3].innerText==subCategory)
		{
			tr[i].style.display = "";
			found = false;
		} else {
			tr[i].style.display = "none";
		}
	}
}

//show a red error message
function errorMessage(message)
{
	var messageBox=gEbID("messageBox");
	messageBox.innerText=message;
	messageBox.classList.remove("green");
	messageBox.classList.add("red");
	messageBox.style.display="inherit";
	setTimeout(function(){gEbID("messageBox").style.display="none";},2000);
	
}	

//show a green sucess message
function successMessage(message)
{
	var messageBox=gEbID("messageBox");
	messageBox.innerText=message;
	messageBox.classList.remove("red");
	messageBox.classList.add("green");
	messageBox.style.display="inherit";
	setTimeout(function(){gEbID("messageBox").style.display="none";},2000);
}	

//} #endregion GUI helper functions


//{ #region miscellanious helper functions

//shortcut for document.getElementById to save boring typing. 
function gEbID(id)
{
	return document.getElementById(id);
}

//create a hash of a text using browser's crypto api
async function sha256(text) 
{
	// add some juice to prevent rainbow tables.
	text=text+"`rpx%/[7_e{P-è:xR?ffíqOqär?3GGî+5a$%rMr?áTö7ìu7A$b9âá3;A(k06fPâ13LK%YgtzIbìwj.Td´ulHkB_!5eä{MOWL=p#V"; 
	// encode as (utf-8) Uint8Array
    const msgUint8 = new TextEncoder().encode(text);       
	// hash the text	
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);   
	// convert buffer to byte array
    const hashArray = Array.from(new Uint8Array(hashBuffer)); 
	// convert bytes to hex string
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); 
    return hashHex;
}

//sort the data object by category, subcategors and description
//returns a sort-function
function sortByCategoryFunction() 
{    
    return function(a, b) 
	{
		var categoryA=a[2].toUpperCase()+a[3].toUpperCase()+a[1].toUpperCase();
		var categoryB=b[2].toUpperCase()+b[3].toUpperCase()+b[1].toUpperCase();
        if (categoryA > categoryB) 			
            return 1;    
        else if (categoryA < categoryB)
            return -1;    
        return 0;    
    }   
} 

//get a slice of the data object
function getJSONdataRow(ID)
{
	for (var i = 0; i < data.length; i++) 
	{
		if (data[i][0] == ID)
		{
			return data[i];
		}
	}
}
 
//create a random password based on the selection in the new account form
function createPassword()
{	

	//define the all possible characters to randomly choose from
	
	//basic latin
	var letterSource="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	var numberSource="0123456789";
	//basic latin specials except "\'
	var specialSource="!#$%&()*+,-./:;=?@[]^_`{|}~";
	//Latin1 supplemental
	var supplementalSource="¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ";
	//just some random utf8-characters with different lengths
	var utf8Source="ӾƈͮŎЖհͼɷФЗЁИڡǮ̉ȳĭۥ̼ĩЌғэשζӣҕѼܤ֦о؊ۿӌщթēݗɷɼүҺàԧІކʦӅփڄجزات"; 				//2-bytes
		utf8Source+="躮扯刺籷ᶧ뵞狗哎㙠槩㘉筺畠演幪殙韫诟麡傟啨꧵賄빚䥓ꧬ侈㻛軰買閽⢢氓뷡"; 			//3-bytes
		utf8Source+="𠰞𤓒𪶁𤡅𥩍𥾉𥇖𦃘𢳫𧾥𩳉𦉝𡪮𨹇𩜙𪄮"; 								//4-bytes
	//cards and dingbats
	var objectsSource="🂡🂢🂣🂤🂥🂦🂧🂨🂩🂪🂫🂬🂭🂮🂱🂲🂳🂴🂵🂶🂷🂸🂹🂺🂻🂼🂽🂾🃁🃂🃃🃄🃅🃆🃇🃈🃉🃊🃋🃌🃍🃎🃑🃒🃓🃔🃕🃖🃗🃘🃙🃚🃛🃜🃝🃞🀀🀁🀂🀃🀄🀅🀆🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓🀔🀕🀖🀗🀘🀙🀚🀛🀜🀝🀞🀟🀠🀡🀢🀣🀤🀥🀦🀧🀨🀩🀪🀫"; 
		objectsSource+="✀✁✂✃✄✅✆✇✈✉✊✋✌✍✎✏✐✑✒✓✔✕✖✗✘✙✚✛✜✝✞✟✠✡✢✣✤✥✦✧✨✩✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋❌❍❎❏❐❑❒❓❔❕❖❗❘❙❚❛❜❝❞❟❠❡❢❣❤❥❦❧❨❩❪❫❬❭❮❯❰❱❲❳❴❵❶❷❸❹❺❻❼❽❾❿➀➁➂➃➄➅➆➇➈➉➊➋➌➍➎➏➐➑➒➓➔➕➖➗➘➙➚➛➜➝➞➟➠➡➢➣➤➥➦➧➨➩➪➫➬➭➮➯➰➱➲➳➴➵➶➷➸➹➺➻➼➽➾➿";


	//unicode block emoticons and nature
	var emojiSource="😀😁😂😃😄😅😆😇😈😉😊😋😌😍😎😏😐😑😒😓😔😕😖😗😘😙😚😛😜😝😞😟😠😡😢😣😤😥😦😧😨😩😪😫😬😭😮😯😰😱😲😳😴😵😶😷🙁🙂🙃🙄🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐽🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦟🦗🕷🕸🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮🐕‍🦺🐈🐓🦃🦚🦜🦢🦩🕊🐇🦝🦨🦡🦦🦥🐁🐀🐿🦔🐾🐉🐲🌵🎄🌲🌳🌴🌱🌿☘️🍀🎍🎋🍃🍂🍁🍄🐚🌾💐🌷🌹🥀🌺🌸🌼🌻🌞🌝🌛🌜🌚🌕🌖🌗🌘🌑🌒🌓🌔🌙🌎🌍🌏🪐💫⭐️🌟✨⚡️☄️💥🔥🌪🌈☀️🌤⛅️🌥☁️🌦🌧⛈🌩🌨❄️☃️⛄️🌬💨💧💦☔️☂️🌊🌫";
	
	//assemble the character pool based on the selection in the form
	var source="";
	
	if(gEbID("newPassword_basicLatinLetters").checked)
		source+=letterSource;
	if(gEbID("newPassword_numbers").checked)
		source+=numberSource;
	if(gEbID("newPassword_commonSpecialCharacters").checked)
		source+=specialSource;
	if(gEbID("newPassword_unCommonSpecialCharacters").checked)
		source+=supplementalSource;
	if(gEbID("newPassword_foreignLetters").checked)
		source+=utf8Source;
	if(gEbID("newPassword_objects").checked)
		source+=objectsSource;
	if(gEbID("newPassword_emojis").checked)
		source+=emojiSource;
	
	if(source=="")
		return "";
	
	//make the source utf-8 safe. Otherwise, substr won't work for 2, 3, or 4-byte characters.
	var sourceUTF8 = new wString(source);	
	var sourceLength=sourceUTF8.length;	
	//now create a truly random password with the configured length which is based on the selected character pool
	var newPassword="";
	for (var i = 0; i < passwordSuggestionLength; i++) 
	{
		newPassword+=sourceUTF8.substr(Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * sourceLength),1)
	}
	
	return newPassword;
}

//creates a valid UTF-string to work with.
//https://stackoverflow.com/a/6889627
function wString(str){
  var T = this; //makes 'this' visible in functions
  T.cp = [];    //code point array
  T.length = 0; //length attribute
  T.wString = true; // (item.wString) tests for wString object

//member functions
  sortSurrogates = function(s){  //returns array of utf-16 code points
    var chrs = [];
    while(s.length){             // loop till we've done the whole string
      if(/[\uD800-\uDFFF]/.test(s.substr(0,1))){ // test the first character
                                 // High surrogate found low surrogate follows
        chrs.push(s.substr(0,2)); // push the two onto array
        s = s.substr(2);         // clip the two off the string
      }else{                     // else BMP code point
        chrs.push(s.substr(0,1)); // push one onto array
        s = s.substr(1);         // clip one from string 
      }
    }                            // loop
    return chrs;
  };
//end member functions

//prototype functions
  T.substr = function(start,len){
    if(len){
      return T.cp.slice(start,start+len).join('');
    }else{
      return T.cp.slice(start).join('');
    }
  };

  T.substring = function(start,end){
    return T.cp.slice(start,end).join('');
  };

  T.replace = function(target,str){
    //allow wStrings as parameters
    if(str.wString) str = str.cp.join('');
    if(target.wString) target = target.cp.join('');
    return T.toString().replace(target,str);
  };

  T.equals = function(s){
    if(!s.wString){
      s = sortSurrogates(s);
      T.cp = s;
    }else{
        T.cp = s.cp;
    }
    T.length = T.cp.length;
  };

  T.toString = function(){return T.cp.join('');};
//end prototype functions

  T.equals(str)
};


//} #endregion miscellanious helper functions

