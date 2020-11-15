<?php

//give SHA256 hashes that are valid for use. More than one hash may be given here. If empty, all hashes are valid.
//there will be no warning, if the entered password does not match. It will simply happen nothing.
//hash will be shown in javascript console when  clicking "login"
//note: predefined hash efb3831c605a737d7c51b54ceb40ea482ff96ae979115df82f023bbe3f57c5b0 matches password "showMyAccounts". You should definitely delete after your personal tests.
$validSHA=array("efb3831c605a737d7c51b54ceb40ea482ff96ae979115df82f023bbe3f57c5b0");

//add some more entropy to the passwords to prevent rainbow tables.
//you should definately set this value during first configuration. If you change it later, all your accounts will be inaccessable. 
$masterRealm="c¶jàº𠰞oxBvǮ㘉ãζÓ»ɼ𦉝ëRƈäÀkZu`Vғ扯賄ڄ𠰞È½:ËЗ«ӣƈäÀkZu`Vғ扯賄ڄ𠰞È½:ËЗ«ӣ𦃘Ӆԧ哎ÙÉútÏ뷡氓Q𥩍ꧬàÝհЖÉî½º¼$Ðßýþ¡ßIÓ¨zDÐK;ì]";

//give categories to choose from
//give the description as key and an emoji as value. Emojis will be shown in tree view.
$categories=array("Banking"=>"💰","eMail"=>"📧","Forum"=>"🧩","FTP"=>"📁","Shop"=>"🛒",);

//give subcategories to choose from.
//give the description as key and an emoji as value.
$subCategories=array("Jane"=>"👩","John"=>"👨","Friends"=>"🍺","Work"=>"🏭");


//show subcategory emojis in treeview. This may be confusing. If false, the category emoji is shown instead.
$showSubCategorieIconsInTreeview=false;

//length of suggested passwords for new accounts
$passwordSuggestionLength=20;

//suggested passwords will be created based on these characters
$passwordSuggestionDefaults["basicLatinLetters"]=true;
$passwordSuggestionDefaults["numbers"]=true;
$passwordSuggestionDefaults["commonSpecialCharacters"]=true;
$passwordSuggestionDefaults["unCommonSpecialCharacters"]=true;
$passwordSuggestionDefaults["foreignLetters"]=false;
$passwordSuggestionDefaults["objects"]=false;
$passwordSuggestionDefaults["emojis"]=true;

//set seconds of activity until master password has to be given again
$pageInactivityTimeout=300;

?>