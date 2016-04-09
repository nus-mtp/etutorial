/**
 * This module contains the basic function of managing & storing rooms, groups and socket clients information
 * @type {*|exports|module.exports}
 */
var express = require ('express');
var socket = require ('socket.io');
var lobby = new Lobby ();
var Presentations = require('./Presentations');
var tutorial = require ('./Tutorial');
var ColorManager = require('./ColorManager');

var getLobby = function () {
	return lobby;
}


/**
 * Lobby contruct an object that stores all the rooms into a hash map
 * @constructor
 */
function Lobby () {
	this.count = 0;
	this.rooms = {};
}

/**
 * Return number of rooms in lobby
 * @returns {number}
 */
Lobby.prototype.size = function () {
	return this.count;
}

/**
 * Add room to lobby and import existing user tutorial relationship into room storage
 * @param roomId
 * @param room
 * @returns {room}
 */
Lobby.prototype.findOrAddRoom = function (roomId, room) {
	var lobby = this;
	return new Promise(function(fulfill, reject){
		if (room instanceof Room) {
			if (lobby.rooms[roomId]) {
				fulfill(lobby.rooms[roomId]);
			} else {
				return tutorial.findAndCountAllUsersInTutorial (roomId).then (function (users) {
					lobby.rooms[roomId] = room;
					lobby.count++;

					for (var i in users.rows) {
						var socketClient = new SocketClient (users.rows[i].name, users.rows[i].id, null);
						socketClient.connected = false;
						socketClient.regist (roomId);
					}
				}).then(function(){
					fulfill(lobby.rooms[roomId]);
				}).catch(function(err){
					console.error('Add room failed with error: ' + err.stack);
					reject(false);
				})
			}
		} else {
			console.error('Parameter room is not an instance of Room');
			reject('Parameter room is not an instance of Room');
		}
	});
}

/**
 * Remove room with roomId
 * @param roomId
 * @returns {boolean}
 */
Lobby.prototype.removeRoom = function (roomId) {
	if (this.rooms[roomId]) {
		delete this.rooms[roomId];
		this.count--;
		return true;
	} else return false;
}

/**
 * Remove all rooms in lobby
 * @returns {boolean}
 */
Lobby.prototype.removeAllRooms = function () {
	this.rooms = {};
	this.count = 0;
	return true;
}

/**
 * Retrieve room instance with roomId
 * @param roomId
 * @returns {Room} return room instance
 */
Lobby.prototype.get = function (roomId) {
	var room = this.rooms[roomId];
	if (room) {
		return room;
	} else return null;
}

/**
 * Retrieve the maps of all rooms
 * @returns {{}|{Room}}
 */
Lobby.prototype.getRoomsMap = function () {
	return this.rooms;
}

Lobby.prototype.getUser = function (userId) {
	for (var roomID in this.rooms) {
		var group = this.rooms[roomID].get ('default');
		for (var user in group.socketClientMap) {
			if (user == userId) {
				return group.socketClientMap[user];
			}
		}
	}
	return null;
}

/**
 * Room construct an object that stores all the groups into a hash map
 * @constructor
 */
function Room () {
	this.active = false;
	this.tutors = {};
	var defaultGroup = new Group ('default');
	this.count = 1;
	this.groups = {};
	this.groups[defaultGroup.groupId] = defaultGroup;
}

/**
 * Returns size of current Room
 * @returns {number}
 */
Room.prototype.size = function () {
	return this.count;
}

/**
 * Add group into current room
 * @param group
 * @returns {boolean}
 */
Room.prototype.addGroup = function (group) {
	if (group instanceof Group) {
		if (this.groups[group.groupId]) {
			return false;
		}
		this.groups[group.groupId] = group;
		this.count++;
		return true;
	} else return false;
}


/**
 * Remove group according to its groupId
 * @param groupId
 * @returns {boolean}
 */
Room.prototype.removeGroup = function (groupId) {
	if (groupId === 'default') {
		return false;
	}
	if (this.groups[groupId]) {
		delete this.groups[groupId];
		this.count--;
		return true;
	} else return false;
}

/**
 * Regist socketClients to room before active them
 * @param socketClient
 * @returns {boolean}
 */
Room.prototype.registClient = function(socketClient){
	if (socketClient instanceof SocketClient){
		if (this.get('default').addClient(socketClient)){
			return true;
		} else return false;
	}
}

/**
 * Renew socketClients
 * @param socketClient
 * @returns {boolean}
 */
Room.prototype.activeClient = function(socketClient){
	if (this.hasUser(socketClient.userID)){
		if (this.get('default').renewClient(socketClient)){
			return true;
		} else {
			return false;
		}
	} else {
		return false
	}
}

/**
 * Retrieve the group according to its groupId
 * @param groupId
 * @returns {*}
 */
Room.prototype.get = function (groupId) {
	var group = this.groups[groupId];
	if (group) {
		return group;
	} else return null;
}

/**
 * Retrieve the Room
 * @returns {{}|*}
 */
Room.prototype.getGroupsMap = function () {
	return this.groups;
}

/**
 * Return
 * @param uid
 * @returns {boolean}
 */
Room.prototype.hasUser = function(uid) {
	if (this.get('default').get(uid)) {
		return true;
	} else {
		return false;
	}
}

/**
 * set room actived
 */
Room.prototype.setActive = function(){
	this.active = true;
}

/**
 * Room emit message
 */
Room.prototype.emit = function(key, value){
	var clients = this.get('default').getClientsMap();
	for (var client in clients) {
		if (clients[client] == this) {
			value.isSelf = true;
		} else {
			value.isSelf = false;
		}
		clients[client].emit(key, value);
		//console.log(clients);
	}
}


/**
 * Group stores socket clients into a hash map
 * @param groupId
 * @constructor
 */
function Group (groupId) {
	this.groupId = groupId;
	this.count = 0;
	this.socketClientMap = {};
	this.presentations = new Presentations;
	this.colorManager = new ColorManager();
}

/**
 * Return size of current Group
 * @returns {number}
 */
Group.prototype.size = function () {
	return this.count;
}

/**
 * Add user socket client into Group
 * @param socketClient
 * @returns {boolean}
 */
Group.prototype.addClient = function (socketClient) {
	socketClient.color = this.colorManager.getUniqueRandomColor();
	if (socketClient instanceof SocketClient) {
		if (this.socketClientMap[socketClient.userID]) {
			this.socketClientMap[socketClient.userID] = socketClient;
			return true;
		} else {
			this.socketClientMap[socketClient.userID] = socketClient;
			this.count++;
			return true;
		}
	} else return false;
}

Group.prototype.renewClient = function(socketClient){
	socketClient.color = this.colorManager.getUniqueRandomColor();
	if (socketClient instanceof SocketClient) {
		if (this.socketClientMap[socketClient.userID]) {
			this.socketClientMap[socketClient.userID] = socketClient;
			return true;
		} else return false;

	} else return false;
}

/**
 * Remove user socket client from Group according to the input user id
 * @param userId
 */
Group.prototype.removeClient = function (userId) {
	if (this.socketClientMap[userId]) {
		this.socketClientMap[userId].connected = false;
		this.socketClientMap[userId].socket = null;
		this.count--;
	}
}

/**
 * Retrieve socket client according to its user id
 * @param userId
 * @returns {*}
 */
Group.prototype.get = function (userId) {
	var socketClient = this.socketClientMap[userId];
	if (socketClient) {
		return socketClient;
	} else return null;
}

/**
 * Retrieve map of all socket clients
 * @returns {{}|*}
 */
Group.prototype.getClientsMap = function () {
	return this.socketClientMap;
}

/*
 * Retrieve the list of connected clients
 * @returns [{}|*]
 * */
Group.prototype.getConnectedClientsList = function () {
	var dataArray = [];
	for (var element in this.socketClientMap) {
		if (this.socketClientMap[element].connected) {
			dataArray.push (this.socketClientMap[element]);
		}
	}
	return dataArray;
}

/**
 * Socket Client Wrapper for storing user ID and user socket
 * @param userId
 * @param socket
 * @constructor
 */
function SocketClient(userName, userId, socket) {
	if (socket == null) {
		// initialization
		this.socket = null;
		this.socketID = null;
		this.header = null;
		this.connected = false;
		this.color = null;
	} else {
		this.socket = socket;
		this.socketID = socket.id;
		this.header = socket.request.headers;
		this.connected = socket.connected;
	}

	this.userName = userName;
	this.userID = userId;
	this.currentGroupID = null;
	this.currentRoomID = null;
}

/*
 * Set value of this.connected to false
 * */
SocketClient.prototype.setDisconnect = function () {
	this.connected = false;
}

/**
 * Notify All user in current room on user leave
 */
SocketClient.prototype.notifyGroupUsersOnUserLeave = function () {
	this.roomBroadcast ('User Leave', {'userID': this.socketID});
}

/**
 * Socket listener wrapper
 * @param evt
 * @param callback
 */
SocketClient.prototype.on = function (evt, callback) {
	this.socket.on (evt, callback);
}

SocketClient.prototype.getRoom = function () {
	if (this.currentRoomID != null) {
		return getLobby ().get (this.currentRoomID);
	} else return null;
}

/**
 * Add Socket Client to a room by its room id
 * @param roomId
 * @return {boolean}
 */
SocketClient.prototype.joinRoom = function (roomId) {
	var room = getLobby().get(roomId);
	if ((room != null) && room.activeClient(this)){
		this.currentRoomID = roomId;
		this.currentGroupID = 'default';
		return true;
	} else {
		return false;
	}
}

/**
 * Regist user to the room
 * @param roomId
 * @returns {boolean}
 */
SocketClient.prototype.regist = function (roomId){
	var room = getLobby().get(roomId);
	if (room) {
		if (room.registClient(this)) {
			this.currentGroupID = 'default';
			this.currentRoomID = roomId;
			return true;
		} else {
			console.error('!ERROR ###### Cannot regist client, roomId: ' + roomId + ' client id: ' + this.userID);
			return false;
		}
	} else {
		console.error('!ERROR ###### Cannot regist client, Room Not Exist! roomId: ' + roomId + ' client id: ' + this.userID);
		return false;
	}
}

SocketClient.prototype.inRoom = function (roomId) {
	return (roomId === this.currentRoomID);
}

SocketClient.prototype.leaveRoom = function () {
	if (this.currentRoomID == null) {
		return false;
	} else {
		var currentGroup = getLobby ().get (this.currentRoomID).get (this.currentGroupID);
		if (this.currentGroupID !== 'default'){
			currentGroup.removeClient (this.userID);
		}
		this.connected = false;
		this.currentGroupID = null;
		this.currentRoomID = null;
	}
}

SocketClient.prototype.joinGroup = function (roomId, groupId) {
	if (this.inRoom (roomId)) {
		var group = getLobby ().get (roomId).get (groupId);
		if (group && (group instanceof Group)) {
			group.addClient (this);
			this.currentGroupID = groupId;
		}
	}
}

SocketClient.prototype.inGroup = function (roomId, groupId) {
	return (this.inRoom (roomId) && groupId === this.currentGroupID);
}

//SocketClient.prototype.leaveGroup = function (roomId, groupId) {
//	if (this.inGroup (roomId, groupId) && (this.currentGroupID != 'default')) {
//		var group = getLobby ().get (roomId).get (groupId);
//		if (group && (group instanceof Group)) {
//			group.removeClient (this.userID);
//			this.currentGroupID = 'default';
//		}
//	}
//}


SocketClient.prototype.leaveGroup = function() {
	var currentGroup = this.getCurrentGroup();
	currentGroup.removeClient(this.userID);
}

SocketClient.prototype.getCurrentGroup = function () {
	return getLobby ().get (this.currentRoomID).get (this.currentGroupID);
}

SocketClient.prototype.getCurrentGroupUserList = function () {
	var curGroup = this.getCurrentGroup ();
	return curGroup.getConnectedClientsList ();
}

/**
 * Socket Emit wrapper
 * @param key
 * @param value
 */
SocketClient.prototype.emit = function (key, value) {
	if (this.socket == null) return false;
	this.socket.emit (key, value);
}

/**
 * Room Broadcaster
 * @param key
 * @param value
 */
SocketClient.prototype.roomBroadcast = function (key, value) {
	var clients = getLobby ().get (this.currentRoomID).get ('default').getClientsMap ();
	//console.log ('all clients' + clients);
	//null check not implemented!
	for (var client in clients) {
		if (clients[client] == this) {
			value.isSelf = true;
		} else {
			value.isSelf = false;
		}
		clients[client].emit(key, value);
		//console.log(clients);
	}
}

SocketClient.prototype.personalMessage = function (key, value, receiverId) {
	var clients = getLobby ().get (this.currentRoomID).get (this.currentGroupID).getConnectedClientsList ();
	//null check not implemented!
	for (var client in clients) {
		if (client.userId == receiverId) {
			client.emit (key, value);
		}
	}
}

/**
 * Group Broadcaster
 * @param name
 * @param key
 * @param value
 */
SocketClient.prototype.groupBroadcast = function (key, value) {
	var clients = getLobby ().get (this.currentRoomID).get (this.currentGroupID).getClientsMap ();
	//null check not implemented!
	for (var client in clients) {
		//if (clients[client] == this) {
			//continue;
		//}
		clients[client].emit(key, value);
	}
}

/**
 * Stringify Socket Client JSON object
 * @returns {SocketClient}
 */
SocketClient.prototype.toJSON = function () {
	var tojson = {};
	tojson.userID = this.userID;
	tojson.username = this.userName;
	tojson.socketID = this.socketID;
	tojson.color = this.color;
	tojson.currentGroupID = this.currentGroupID;
	tojson.currentRoomID = this.currentRoomID;
	tojson.connected = this.connected;
	return tojson;
}


module.exports.getLobby = getLobby;
module.exports.SocketClient = SocketClient;
module.exports.Lobby = Lobby;
module.exports.Room = Room;
module.exports.Group = Group;
module.exports.isActive = function(roomId){
	try{
		return getLobby().get(roomId).active;
	} catch(e){
		return false;
	}

};
module.exports.hasUser = function(roomId, userId) {
	if (getLobby().get(roomId).hasUser(userId)){
		return true;
	} else return false;
};
module.exports.hasTutor = function(roomId, userId){
	if (getLobby().get(roomId).tutors[userId]){
		return true;
	} else return false;
};