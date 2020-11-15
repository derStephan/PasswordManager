# Handle your passwords in your browser

This is a password manager for your browser. Never remember more than your own personal master password. Your accounts will be encrypted with that master password and will be securely saved on any PHP-ready server. Your accounts as well as your master password will never be transferred to your server in plain text. Everything is done in your browser, you don't have to trust your server or your provider.

This software is developed with minimal complexity in mind. 

On the client side there is no dependecy at all, just native javascript. Encryption is done using the standard crypto functions that are already built in your modern browser. Will work in Firefox, Chrome, Safari and Edge on your desktop or on your mobile device. Everything is done by 50KB of Javascript and that includes extensive comments.

On the server side, there is only one PHP file that will be called by ajax and one which holds the configuration. Encrypted data will be stored in text files, you don't need a database. Works with any PHP version >5. Again, goal was minimal complexity. Both PHP files sum up to about 4kB and that includes extensive comments as well. 

## How are your accounts protected?

### Load account data from server

![process to load data](https://user-images.githubusercontent.com/7764931/99197254-9b0d1880-2791-11eb-8668-73da1be84011.png)


### store account data on server

![process to store data](https://user-images.githubusercontent.com/7764931/99197467-fdb2e400-2792-11eb-8ece-47c851958f0b.png)


## Features

* Login with a master passwords
  * there may be any number of master passwords on the server
  * each master password represents a file on the server, 
  * so master passwords are completely independet of each other
  * to be frank: each master password opens only the matching accounts
* Show accounts in a table
  * table is searchable
  * table is sortable
  * login, password or url of an account can be copied to clipboard
  * accounts are editable from
* Display a tree of categories and sub categories
  * click on a category or a subcategory filters the table
  * categories and sub categories are configurable
  * icons of categories and sub categories are configurable
* new accounts can be added
  * a truly random password with selectable complexity will be suggested
  * password length and complexity is configurable
* master password can be changed
* no frills
* no complexity

## Installation

1. copy everything on a server that supports PHP with a version >5. 
2. point your server configuration to the public folder. DO NOT EXPOSE THE ROOT FOLDER OF THIS PROJECT!
3. open your browser and login with your new master password. Open the console of your browser (F12) and copy the shown hash
4. add this hash to your config.php which can be found in the folder private
5. tweak the config.php according to your needs.

## screenshots


### account table and tree view
![table and tree](https://user-images.githubusercontent.com/7764931/99196005-cf7cd680-2789-11eb-97d6-61d6e49bb789.png)


### new account

![new account](https://user-images.githubusercontent.com/7764931/99196048-24b8e800-278a-11eb-8a5a-c4be3cbcd19f.png)

### change master password

![change master password](https://user-images.githubusercontent.com/7764931/99196062-46b26a80-278a-11eb-934d-75a57f428d4e.png)
