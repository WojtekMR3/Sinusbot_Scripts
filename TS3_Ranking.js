registerPlugin({
  name: 'TS3 Ranking',
  version: '2.0',
  description: 'Clients are added to server groups after reaching required time.',
  author: 'R3flex <r3flexmlg@gmail.com>',
  engine: ">= 1.0.0",
  // ENABLEWEB: true,
  // REQUIREDMODULES: ['ws'],
  vars: {
  afirstGroup: {
    title: 'Specify the server group ID of the first level.',
    type: 'number'
  },
  enable_migration: {
    title: 'Enable migrations',
    type: 'checkbox'
  },
  migration_export_amount: {
    title: 'Entries amount to export.',
    type: 'number',
    conditions: [{
        field: 'enable_migration',
        value: 1,
    }]
  },
  migration_sgid: {
    title: 'SGID needed to execute migration commands.',
    type: 'number',
    conditions: [{
        field: 'enable_migration',
        value: 1,
    }]
  },
  Levels: {
    title: 'Level',
    type: 'array',
    vars: [
      {
        name: 'time',
        indent: 1,
        title: 'Time to gain this level. (hours)',
        type: 'number',
        placeholder: '5'
      },
      {
        name: 'sgid',
        indent: 1,
        title: 'Servergroup ID.',
        type: 'number',
        placeholder: '32'
      },
      {
        name: 'msg_type',
        indent: 1,
        title: 'Message Type.',
        type: 'select',
        options: ['None', 'Poke', 'Chat']
      },
      {
        name: 'msg',
        indent: 1,
        title: 'Message.',
        type: 'string',
        placeholder: 'You advanced to 10 level!'
      }
      ]
  },
  ignoredGroups: {
    title: 'Ignored Group.',
    type: 'array',
    vars: [
      {
        name: 'ignoredGroup',
        indent: 1,
        title: 'Servergroup ID.',
        type: 'string',
        placeholder: '8'
      }
    ]
  },
  ignored_uids: {
    title: 'Ignored UIDs.',
    type: 'array',
    vars: [
      {
        name: 'uid',
        indent: 1,
        title: 'UID:',
        type: 'string',
        placeholder: 'K9FOHtY/nMjzfZaSFjAnZA4'
      }
    ]
  },
  AFKthreshold: {
    title: 'Specify the anty afk threshold in minutes (After this amount of minutes, the script will stop adding the time.)',
    type: 'number'
  },
  drankingChannel: {
    title: 'TOP 10 ranking channel.',
    type: 'channel'
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

var event = require('event');
var store = require('store');
var engine = require('engine');
var backend = require('backend');
var format = require('format');

var delayTime = 60;

// Sanitize variables
const levels = config.Levels;
const levels_sorted = levels.sort((a, b) => new Number(b.time) - new Number(a.time));
const ignored_groups = config.ignoredGroups;
const ignored_UIDs = config.ignored_uids;
const afk_time = config.AFKthreshold || 20;
var channel = backend.getChannelByID(config.drankingChannel);
var limit = config.etopChannelRecords || 0;
const list_nick_color = config.recordaNameColor || '#33BB00'; 
const list_time_color = config.recordbTimeColor || '#EEEE00';
const list_format_color = config.recordcFormatColor || '#BAE9FF';
// Migration
const migration_enabled = config.enable_migration;
const migration_export_amount = config.migration_export_amount || 50;
const migration_sgid = config.migration_sgid || -100;

// Startup DB
if (!store.get('client_db')) store.set('client_db', {});
var client_db = store.get('client_db');
var test_client_db = {};

// Log erros
if (!channel) engine.log("Channel ID isn't defined!");
 
// On client join, add/remove levels.
event.on('clientMove', function(ev) {
  var channel = ev.fromChannel;
  if (channel) return;
  var client = ev.client;
  if (!is_client_ignored(client)) {
    if (!client_db[client.uid()]) register_client(client);
  }
  guard_rank(client);
})

event.on('chat', function(ev) {
  if (ev.mode != 1) return;
  let client = ev.client;
  var text = ev.text;
  if (text == "!export_db") {
    // Check if migration is enabled and client has permissions.
    if (!migration_enabled) return client.chat(format.color(format.bold("Migrations are not enabled!"), "#d2b72f"));
    if (!has_server_group(client.getServerGroups(), migration_sgid)) return client.chat(format.color(format.bold("You dont have permissions to use migration!"), "#d2b72f"));
    // Get client_db.
    let db = store.get('client_db');
    // Create entries from object.
    let entries = Object.entries(db);
    // Sort entries
    let entries_sorted = entries.sort((a, b) => new Number(b[1].time) - new Number(a[1].time));
    // Apply export amount limit.
    if (entries_sorted.length > migration_export_amount) entries_sorted.length = migration_export_amount;
    if (entries_sorted.length == 0) return client.chat(format.bold(`${format.color("Exporting failed!", "#ff3e3e")} Database is empty!`));
    let export_db = {};
    entries_sorted.forEach(function(entry) {
      let uid = entry[0];
      let nick = entry[1].nick;
      let time = entry[1].time;
      export_db[uid] = new DB_Client(nick, time);
    });
    client.chat(format.bold(`${format.color("Exporting succesful!", "#00bf00")} Exported ${entries_sorted.length} sets`));
    client.chat(`${format.bold("!import_db")} ${JSON.stringify(export_db)}`);
  }

  if (text.includes("!import_db")) {
    // Check if migration is enabled and client has permissions.
    if (!migration_enabled) return client.chat(format.color(format.bold("Migrations are not enabled!"), "#d2b72f"));
    if (!has_server_group(client.getServerGroups(), migration_sgid)) return client.chat(format.color(format.bold("You dont have permissions to use migration!"), "#d2b72f"));
    text = text.replace("!import_db", "").trim();
    // Check if text is JSON valid.
    if (!IsJsonString(text)) return client.chat(format.color(format.bold("Error JSON is not valid!"), "#ff3e3e")); 
    let import_object = JSON.parse(text);
    let values = Object.values(import_object);
    let keys = Object.keys(import_object);
    // Map values of Client_DB object.
    let true_values = values.map(function(obj) {
      if (obj.hasOwnProperty('time') && obj.hasOwnProperty('nick')) {
        return true;
      } else {
        return false;
      }
    });
    let pos = true_values.findIndex(value => value == false);
    false_value = keys[pos];
    // If each object has properties @int "time", @string "nick".
    if (false_value) return client.chat(`${format.color(format.bold("Invalid format!"), "#ff3e3e")}  Missing property '${format.color(format.bold("time"), "#009fff")}' or '${format.color(format.bold("nick"), "#009fff")}' at ${format.bold(`position: ${pos}`)} ${format.italic(false_value)}`);
    let import_bools = keys.map(function(uid) {
      // If Client_DB entry already exists.
      if (test_client_db[uid]) {
        let time = test_client_db[uid].time;
        // If entry property "time" is higher than imported one - Skip.
        if (time >= import_object[uid].time) {
         client.chat(format.bold(`${format.color("Skipped: ", '#FFA200')} ${import_object[uid].nick}`));
         return false;
        } else { // Import time.
         test_client_db[uid].time += new Number(import_object[uid].time);
         return true; 
        }
      } else { // Import entry.
        test_client_db[uid] = new DB_Client(import_object[uid].nick, new Number(import_object[uid].time));
        return true;
      }
    });
    // Succed, Skip log.
    let succeded_count = import_bools.filter(x => x == true).length;
    let skipped_count = import_bools.length - succeded_count;
    client.chat(`${format.color(format.bold(`Succeded: ${succeded_count}`), '#00bf00')} ${format.color(format.bold(`Skipped: ${skipped_count}`), '#FFA200')}`);
  }
})

function add_time() {
  // Get all online clients.
  var clients = backend.getClients();
  // Filter out afk clients.
  clients = clients.filter(not_afk);
  // Filter ignored clients by sgid.
  clients = clients.filter(not_ignored_by_sgid);
  // Filter ignored clients by UID.
  clients = clients.filter(not_ignored_by_uid);
  // Filter duplicates.
  clients = clients.filter(remove_duplicate);
  // Update time for all users.
  clients.forEach(update_time);
}

function channel_display_ranking() {
  if (!channel) channel = backend.getChannelByID(config.drankingChannel);
  if (!channel) return engine.log("Ranking channel isn't defined!");
  var db = client_db;

  var keys = Object.keys(db);
  keys.forEach(function(uid) {
    var client = backend.getClientByUID(uid);
    if (!client) return;
    // Filter db array with ignored UID's
    if (!not_ignored_by_uid(client)) delete db[uid];
    // Filter db array with ignored SGID's
    if (!not_ignored_by_sgid(client)) delete db[uid];
  });

  // Convert object to array, so sort function will work.
  let values = Object.values(db);
  var db_sorted = values.sort((a, b) => new Number(b.time) - new Number(a.time));
  // If setting is higher than actual list.
  if (db_sorted.length < limit) limit = db_sorted.length;

  var list = "";
  db_sorted.forEach(function(row) {
    var row_formatted = '[*]' + '[SIZE=16][COLOR=' + list_nick_color + '][B]' + row.nick + '[/B][/COLOR][/SIZE]' + '[SIZE=14][B][COLOR='+list_time_color+'] ' + Math.floor(new Number(row.time)/3600/24) + ' [/COLOR][COLOR='+list_format_color+']Days[/COLOR][COLOR='+list_time_color+'] ' + Math.floor((new Number(row.time)%86400)/3600) + ' [/COLOR][COLOR='+list_format_color+']Hours[/COLOR][COLOR='+list_time_color+'] ' + Math.floor((new Number(row.time)%3600)/60) + ' [/COLOR][COLOR='+list_format_color+']Minutes[/COLOR][/B][/SIZE]'; 
    list += row_formatted;
  })
  list = '[list=1]' + list + '[/list]';
  channel.update({description : list});
}

function save_db() {
  store.set("client_db", client_db);
}

function guard_rank(client) {
  var ignored = is_client_ignored(client);
  if (!levels_sorted) return engine.log("Levels are not defined!");
  //var db = store.get("client_db");
  if (client_db[client.uid()]) {
    client.db_time = new Number(client_db[client.uid()].time);
  } else {
    client.db_time = 0;
  };

  if (!ignored) {
  // Find allowed SG.
  var lvl_add = levels_sorted.find(function(level) {
    return new Number(client.db_time) >= new Number(level.time*3600);
  });
  // Add SG.
  // If client has minimum time to get level
  if (lvl_add) {
    if (!has_server_group(client.getServerGroups(), lvl_add.sgid)) {
      client.addToServerGroup(lvl_add.sgid);
      if (lvl_add.msg_type == 1) {
        client.poke(lvl_add.msg);
      } else if (lvl_add.msg_type == 2) {
        client.chat(lvl_add.msg);
      }
    }
    // Find disallowed SG's.
    var lvls_disallowed = levels_sorted.filter(function(level) {
      return lvl_add.sgid != level.sgid;
    });
  // If client has time below lvl-1, mark all levels as disallowed.
  } else {
    lvls_disallowed = levels_sorted;
  }
  // Remove SG's.
  lvls_disallowed.forEach(function(level) {
    if (has_server_group(client.getServerGroups(), level.sgid)) {
      client.removeFromServerGroup(level.sgid);
    }
  });
} else {
  levels_sorted.forEach(function(level) {
    if (has_server_group(client.getServerGroups(), level.sgid)) {
      client.removeFromServerGroup(level.sgid);
    }
  });
}
}

function unset_all() {
  store.unset("client_db");
  store.unset("client_db");
  // for (let i = 0; i < 10; i++) {
  //   store.unset(i);
  // }
}

function rank_guardian_loop() {
  var clients = backend.getClients();
  clients.forEach(function(client) {
    guard_rank(client);
  });
  setTimeout(rank_guardian_loop, delayTime*1000);
}

function channel_loop() {
  channel_display_ranking();
  setTimeout(channel_loop, delayTime*1000);
}

function add_time_loop() {
  add_time();
  setTimeout(add_time_loop, delayTime*1000);
}

function save_db_loop() {
  save_db();
  setTimeout(save_db, delayTime*1000);
}

add_time_loop();
channel_loop();
rank_guardian_loop();
save_db_loop();

function DB_Client(nick, time) {
  this.nick = nick;
  this.time = time;
}

function not_afk(client) {
  return (client.getIdleTime()/1000) < (afk_time*60);
}

function not_ignored_by_sgid(client) {
  var client_sg_list = client.getServerGroups();
  return ignored_groups.every(function(ig_sg) {
    return !has_server_group(client_sg_list, ig_sg.ignoredGroup);
  });
}

function has_server_group(sg_list, sg_id) {
  return sg_list.some(function(sg) {
    return sg.id() == sg_id;
  });
}

function not_ignored_by_uid(client) {
  var uid = client.uid();
  return ignored_UIDs.every(function(ig) {
    return ig.uid != uid;
  });
}

function remove_duplicate(client_target, pos, clients_array) {
  // Transforms original array from [{obj}, {obj}] to [uid, uid]
  return clients_array.map(function(client) { 
    return client.uid();
  }).indexOf(client_target.uid()) == pos;
}

function update_time(client) {
  var uid = client.uid();
  if (client_db[uid]) {
    client_db[uid].time += delayTime;
  } else {
    register_client(client);
  }
}

function register_client(client) {
  client_db[client.uid()] = new DB_Client(client.nick(), 30);
}

function is_client_ignored(client) {
  var sg_ignored = !not_ignored_by_sgid(client);
  var uid_ignored = !not_ignored_by_uid(client);
  return sg_ignored || uid_ignored;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

});