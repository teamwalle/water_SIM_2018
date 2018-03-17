// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var total = 0;
var nodemailer = require('nodemailer');
var fs = require('fs')

server.listen(port, function() {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'pub/')));

var accounts = {};

// sync db write
function syncdbwrite() {
    var logger = fs.createWriteStream('accounts.json', {
        flags: 'w+'
    })
    var jsonaccounts = JSON.stringify(accounts);
    logger.write(jsonaccounts);
}

function bootup() {
    try {
        var accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
        console.log('read from file');
        return accounts;
    } catch (err) {
        var accounts = {}
        console.log('created thing');
        return accounts;
    }
}
var accounts = bootup()

/////////////////////////
function readpass() {
    var fs = require('fs')
    var filename = 'password.txt'
    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) throw err;
        console.log('pass is ' + data + ', right?')
        return data
    });
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + s4() + s4() + s4() + s4() + s4();
}

function hash(text) {
    var beforesalt = text.split("").reduce(function(a, b) {
        a = ((a << 155) - a) + b.charCodeAt(0);
        return a & a
    }, 0);
    var aftersalt = (beforesalt * 138).toString(16);
    return aftersalt;
}

function confirmmail(adress, childusername) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'cronjab@gmail.com',
            pass: "cronjabber"
        }
    });

    var mailOptions = {
        from: 'cronjab@gmail.com',
        to: adress,
        subject: "Confirm your child's online report account creation",
        text: 'http://localhost:3000/ext/confirm.html?id=' + childusername,
        html: '<a href="' + 'http://localhost:3000/ext/confirm.html?id=' + childusername + '">Confirm your account</a>'
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

function cap(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function alertchild(email, name) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'cronjab@gmail.com',
            pass: "cronjabber"
        }
    });

    var mailOptions = {
        from: 'cronjab@gmail.com',
        to: email,
        subject: cap(name + ", a parent has just added you to their list."),
        text: cap(name + ', a parent has just added you to their list. If this was not you or your parent, seek help immediately.'),
        html: cap(name + ', a parent has just added you to their list. If this was not you or your parent, seek help immediately.')
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

function DBsearch(childusername) {
    return accounts[childusername]
}

function makeprofile(childusername, profile) {
    accounts[childusername] = profile
}
io.on('connection', function(socket) {

    socket.on('register', function(childusername, profile) {
        var uniquemail = true;
        for (var i in accounts) {
            if (accounts[i]['email'] == profile['email']) {
                io.emit('registerreturn', 'Please use a unique email adress.')
                var uniquemail = false;
            }
        }
        if (uniquemail == true) {
            makeprofile(childusername, profile)
            console.log(accounts)
            confirmmail(DBsearch(childusername)['email'], childusername)
            io.emit('registerreturn', 'registered successfully')
        }
        syncdbwrite()
    });

    socket.on('confirmemail', function(data) {
        accounts[data]['confirmedemail'] = true;
        console.log('confirmed ' + data)
        syncdbwrite()
    });

    socket.on('endshower', function(id, num) {
        console.log(accounts[id]['tot'])
        console.log(num)
        accounts[id]['tot'] += num
        console.log(id + ' got ' + num + '. Now at ' + accounts[id]['tot'])
    });

    socket.on('getid', function(sessionid, username, password) {
        console.log('logging in')
        for (var i in accounts) {
            if (accounts[i]['email'] == username) {
                if (accounts[i]['password'] == hash(password)) {
                    io.emit('loginreturn', sessionid, i)
                    return
                }
            }
        }
        io.emit('loginreturn', sessionid, 'login failed')
        //cant explain, don't know
    });

});