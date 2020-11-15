<?php
if(!isset($_POST["do"]))
	die();


include_once("../private/config.php");

$do=$_POST["do"];

//only valid checksums allowed
if(count($validSHA)>0 && !in_array(strtolower($_POST["hash"]),array_map('strtolower', $validSHA)))
{
	http_response_code(403);
	
	//waste some time (more than 1s)
	usleep(1000000+random_int(1,1000000));
	die();
}


if($do=="check")
{
	//the actual check is done before.
	echo "true";
	die();	
}


if($do=="store")
{
	//check time of last data file. 
	//we only keep a new file every 5 minutes to prevent flooding by correction.
	$files=glob("../private/passwords/{$_POST["hash"]}_*");
	$lastDataFile=end($files);
	//delete files younger than 5 minutes.
	if(filemtime($lastDataFile)>strtotime("-5minutes"))
		unlink($lastDataFile);
	
	
	//store data
	file_put_contents ("../private/passwords/".$_POST["hash"]."_".date("ymd_His").".pwd",$_POST["data"] );
	die();
}

if($do=="load")
{
	//get the latest file for the given hash
	$files=glob("../private/passwords/{$_POST["hash"]}_*");
	
	$lastDataFile=end($files);

	//get encrypted data
	$dataEncrypted=file_get_contents($lastDataFile);
	//deliver it
	echo $dataEncrypted;
	die();
}

if($do=="getConfig")
{
	//hand over config data from config.php as JSON
	$config["categories"]=$categories;
	$config["subCategories"]=$subCategories;
	$config["masterRealm"]=$masterRealm;
	$config["passwordSuggestionLength"]=$passwordSuggestionLength;
	$config["passwordSuggestionDefaults"]=$passwordSuggestionDefaults;
	$config["showSubCategorieIconsInTreeview"]=$showSubCategorieIconsInTreeview;
	$config["pageInactivityTimeout"]=$pageInactivityTimeout;
	echo json_encode($config);
	die();
}

