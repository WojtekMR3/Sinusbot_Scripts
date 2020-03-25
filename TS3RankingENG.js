registerPlugin({
    name: 'TS3 Ranking',
    version: '1.0',
    description: 'This script will add servergroups to the client upon the given hours.',
    author: 'R3flex <r3flexmlg@gmail.com>',
    vars: {
    afirstGroup: {
      title: 'Specify the server group ID of the first level.',
      type: 'number'
    },
    hoursArray: {
      title: 'Config',
      type: 'array',
      vars: [
        {
          name: 'hours',
          indent: 1,
          title: 'Hours to gain the level: ',
          type: 'string',
          placeholder: '1'
        }]
    },
    ignoredGroups: {
      title: 'Ignored Group.',
      type: 'array',
      vars: [
        {
          name: 'ignoredGroup',
          indent: 1,
          title: 'Group to be ignored:',
          type: 'string',
          placeholder: '8'
        }
      ]
    },
    AFKthreshold: {
      title: 'Specify the anty afk threshold in minutes (After this amount of minutes, the script will stop adding the time.)',
      type: 'number'
    },
    drankingChannel: {
      title: 'TOP 10 ranking channel ID.',
      type: 'number',
      placeholder: 'Where to display ranking?'
    },
    etopChannelRecords: {
      title: 'How many records to display.',
      type: 'number',
      placeholder: '10'
    },
    recordaNameColor: {
      title: 'Nicks Color',
      type: 'string',
      placeholder: '#FFF'
    },
    recordbTimeColor: {
      title: 'Time Color',
      type: 'string',
      placeholder: '#FFF'
    },
    recordcFormatColor: {
      title: 'Format Color',
      type: 'string',
      placeholder: '#FFF'
    }
    

}
}, function main(sinusbot, config) {

var delayTime = 30;
// GLOBALS
var dataArray = [];
var firstDataArray = [];
var sortable = [];
var botList = [];
var allLevelGroups = [];
var allIgnoredGroups = [];
var fg = config.afirstGroup;
var arrayOfGroups = [];
var limit = config.etopChannelRecords;

// Change all level groups from config from object to an array.
for (var iter = 0; iter < config.hoursArray.length+1; iter++) {
  allLevelGroups.push(fg+iter);
}

// Change all ignored groups from config from object to an array.
for (var iter = 0; iter < config.ignoredGroups.length; iter++) {
  allIgnoredGroups.push(config.ignoredGroups[iter].ignoredGroup);
}

var event = require('event');
var store = require('store');
var engine = require('engine');
var backend = require('backend');
var helpers = require('helpers');

event.on('clientMove', function(ev) {
  if(!ev.fromChannel) {
    var evKeys = store.getKeys();
    var evClientSGs = ev.client.getServerGroups();
    if (isNotInServerGroup(evClientSGs, config.ignoredGroups)) { // the client is not bot
      if (isNotInServerGroup(evClientSGs, allLevelGroups)) { // check if client already has any of level groups
        // group adder
        var evFoundClient = false;
        for (var i = 0; i < evKeys.length; i++) {
          if (store.get(evKeys[i])) {
            var evObject = store.get(evKeys[i])[0];
            if (evObject.uid === ev.client.uid()) {
             evFoundClient = true;
             break; 
            }
          }
        }
        if (!evFoundClient) {
          firstDataArray.length = 0;

            firstDataArray.push({
              nick: ev.client.nick(),
              uid: ev.client.uid(),
              time: 0
            });

        var newKey = leftPoss(evKeys);
        store.set(newKey, firstDataArray);

        ev.client.addToServerGroup(fg);
        ev.client.poke('Welcome on my server! You are the #'+(store.getKeys()).length + 'client on the server!');

        }
      }
    }
  }

});

function channelTOP(time) {
var iterationCount = 0;
sortable.length = 0;
botList.length = 0;
var allKeys = store.getKeys();
var all_users = backend.getClients();

// HERE ADD EVENT ON CONNECT TO AUTOMATICLY ADD CLIENTS WHO DOESN'T HAVE ANY OF GROUPS WHICH WILL ACT AS NEW CLIENT ON SERVER, IN MMO GAMES LEVEL 1 IS ALWAYS GAINED UP CREATING CHARACTER.
// ALSO ADD POKE THAT YOU WERE GREETED ON THIS SERVER WITH THE # POSITION OF HOW MANY CLIENTS ARE REGISTERED IN DB.
// see if the client is bot | see if client already has any of level groups | if the client is bot then remove all of his groups

for(var iterator = 0; iterator < all_users.length; iterator++) {

  var user = all_users[iterator];
  var clientNick = user.nick();
  var clientUid = user.uid();

  // ANTI BOT || CREATING BOT LIST AND CHECKING FOR THEIR GROUPS
  var clientServerGroups = all_users[iterator].getServerGroups();
      arrayOfGroups.length = 0;
      for (var i = 0; i < clientServerGroups.length; i++) {
        arrayOfGroups.push(parseInt(clientServerGroups[i].id()));
      } 

  if (!isNotInServerGroup(clientServerGroups, allIgnoredGroups)) {
    botList.push(clientUid);
    if (!isNotInServerGroup(clientServerGroups, allLevelGroups)) {

      var groupsToRemove = intersectionArrays(allLevelGroups, arrayOfGroups);

      for (var i = 0; i < groupsToRemove.length; i++) {
        user.removeFromServerGroup(groupsToRemove[i]);
      }

    } 
    continue;
  }
  // ANTI AFK
  var isAFK = false;
  if ((user.getIdleTime()/1000) > (config.AFKthreshold*60)) {
    isAFK = true;
    continue;
  } 

  // ANTI DUPLICATE
  var duplicate = -1;
  var needle;
  var needle = clientUid;
  for(var count = 0; count < all_users.length; count++) {
    if (needle === all_users[count].uid()) {
      duplicate++;
    }
  }
  if (duplicate) return;

// RESET VARIABLES | START SEARCHING FOR KEY
var found = false;
var foundKey;
var foundTime;

for (var i = 0; i < allKeys.length; i++) {
if (found && (iterationCount !== 0)) break;

if (store.get(allKeys[i])) {
var object = store.get(allKeys[i])[0];

if (iterationCount === 0) {
	sortable.push([object.nick, object.time, object.uid]);
}

      // CLIENT FOUND!
      if (object.uid === clientUid) {
        var found = true;
        var foundKey = allKeys[i];
        var foundTime = parseInt(object.time);
        engine.log(object.nick + ' ' + object.time);
        if (iterationCount !== 0) break;
      }

    }
}
iterationCount = 1;

// GROUP ADDER/REMOVER
if (found) {
  for(var count = -1; count < config.hoursArray.length; count++) {
    
    if (config.hoursArray.length < 1 || config.hoursArray.length == count+1) { // if there is only one level || or if the level is the last one.
      var currentStep;
      if (count === -1) currentStep = 0;
      if (count > -1) currentStep = config.hoursArray[count].hours;
      if (foundTime/3600 > currentStep) {
              if(isNotInServerGroup(clientServerGroups, fg+count+1)) {
                        user.addToServerGroup(fg+count+1);
                        user.poke('Congratulations! You have advanced to '+ (count+2) +' LEVEL, spending more than '+ currentStep +' hours!');
                    }
                    // Group Remover
                var disallowedGroups = allLevelGroups.filter(function(e) { return e !== fg+count+1 });
                  var groupsToRemove = intersectionArrays(arrayOfGroups, disallowedGroups);
                    for (var i = 0; i < groupsToRemove.length; i++) {
                      user.removeFromServerGroup(groupsToRemove[i]);
                    }
        } 
    } else {
      var currentStep;
      if (count === -1) currentStep = 0;
      if (count > -1) currentStep = config.hoursArray[count].hours;
          if (foundTime/3600 > currentStep && foundTime/3600 < config.hoursArray[count+1].hours) {
              if(isNotInServerGroup(clientServerGroups, fg+count+1)) {
                        user.addToServerGroup(fg+count+1);
                        user.poke('Congratulations! You have advanced to '+ (count+2) +' LEVEL, spending more than '+ currentStep +' hours!');
                    }
                    // Group Remover
                var disallowedGroups = allLevelGroups.filter(function(e) { return e !== fg+count+1 });
                  var groupsToRemove = intersectionArrays(arrayOfGroups, disallowedGroups);
                    for (var i = 0; i < groupsToRemove.length; i++) {
                      user.removeFromServerGroup(groupsToRemove[i]);
                    }
        } 
      } 
    }



//if (isAFK) continue; 
dataArray.length = 0;

  //UPDATE THE ENTRY
  var newTime = parseInt(foundTime + delayTime);
  dataArray.push({
    nick: clientNick,
    uid: clientUid,
    time: newTime
  });
  store.set(foundKey, dataArray);

} 
};

// TOP RECORDS SHOWN ON GIVEN CHANNEL
var sortedArray = sortable.sort(function(a, b){
    return b[1]-a[1];
})

var s = "";
if (found) {
 for(var counter = 0; counter < limit; counter++) {
    if (!contains(botList, sortedArray[counter][2])) {
      var xyz = '[*]' + '[SIZE=16][COLOR='+config.recordaNameColor+'][B]' + sortedArray[counter][0] + '[/B][/COLOR][/SIZE]' + '[SIZE=14][B][COLOR='+config.recordbTimeColor+'] ' + Math.floor(sortedArray[counter][1]/3600/24) + ' [/COLOR][COLOR='+config.recordcFormatColor+']Days[/COLOR][COLOR='+config.recordbTimeColor+'] ' + Math.floor((sortedArray[counter][1]%86400)/3600) + ' [/COLOR][COLOR='+config.recordcFormatColor+']Hours[/COLOR][COLOR='+config.recordbTimeColor+'] ' + Math.floor((sortedArray[counter][1]%3600)/60) + ' [/COLOR][COLOR='+config.recordcFormatColor+']Minutes[/COLOR][/B][/SIZE]'; 
      s += xyz;    
    } else {
    limit++;
    }
}
    var clean_s = s;

var zxc = '[list=1]' + clean_s + '[/list]';
channelUpdate(config.drankingChannel, {description : zxc});

}

}
setInterval(channelTOP, delayTime*1000);



  function isNotInServerGroup(user_servergroups, servergroup_id) {

    if (servergroup_id.length === null || servergroup_id.length === undefined) {
      var needleArray = [];
      needleArray.push(servergroup_id); // Checks if variable is an array, if isnt then it creates a new temp empty array which the variable will be pushed into.
      for (var i = 0; i < needleArray.length; i++) {

      for(var count1 = 0; count1 < user_servergroups.length; count1++) {

        if(user_servergroups[count1].id() == needleArray[i]) {
      
          return false;
        }
      }
      }
      return true;

    } else {

    for (var i = 0; i < servergroup_id.length; i++) {

    for(var count1 = 0; count1 < user_servergroups.length; count1++) {

      if(user_servergroups[count1].id() == servergroup_id[i]) {
      
        return false;
      
      }
      
    }
    }
    return true;
    }
 }

//INTERSECTION FUNCTION
function intersectionArrays(arr1, arr2) {
  var result = arr1.filter(function(n) {
    return arr2.indexOf(n) > -1;
  });
  return result;
}

//DIFFERENCE FUNCTION
function differenceArrays(arr1, arr2) {

  var result = arr1.filter(function(n) {
    return arr2.indexOf(n) === -1;
  });
  engine.log(result);
  return result;
}

function leftPoss(array) {
var all=[],b=array.length+1;while(b--)all[b]=b+1;

var taken = array.toString();

Array.prototype.diff = function (a) {
    return this.filter(function (i) {
        return a.indexOf(i) === -1;
    });
};

return all.diff(taken);
}

function contains(a, obj) {
    var i = a.length;
    while (i--) {
       if (a[i] === obj) {
           return true;
       }
    }
    return false;
}

});