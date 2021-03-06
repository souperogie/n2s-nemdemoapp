const express = require('express');
const router = express.Router();
const nem = require('nem-sdk').default;
const User = require('../model/userModel');

require('dotenv').config();

const endpoint = nem.model.objects.create('endpoint')(
    nem.model.nodes.defaultTestnet,
    nem.model.nodes.defaultPort
);

const common = nem.model.objects.create('common')(
    process.env.WALLET_PASS,
    process.env.TEST_PRIVATE_KEY
);

/* login */
//router.get('/login', (req, res) => {
//    res.render('index.pug');
//});

router.post('/account/dashboard', (req, res) => {
    let data = [];
    let dataTx = [];

    User.findOne({ username: req.body.username, password: req.body.password}, function(err, user) {        
        
        //console.log(userWalletAddress);
        if (!user) return res.sendStatus(404);

        const userWalletAddress = user.get('wallet_address');
        const username = user.get('username');
        const hash = user.get('txHash');

        // fetch all transactions of account
        nem.com.requests.account.transactions.all(endpoint, userWalletAddress).then(function(result) {
            //const message = result.data[0].transaction;
            //console.log(result);

            /*data.push({
                username,
                userWalletAddress
            });*/

            for (let i = 0; i < result.data.length; i++) {
            
                const recipient = result.data[i].transaction.recipient; // transaction recipient
                const timeStamp = nem.utils.format.nemDate(result.data[i].transaction.timeStamp); // timestamp
                const message = nem.utils.format.hexMessage(result.data[i].transaction.message); // message
                const txType = nem.utils.format.txTypeToName(result.data[i].transaction.type); // transaction type
                const fmt = nem.utils.format.nemValue(result.data[i].transaction.amount); // amount
                const amount = fmt[0] + "." + fmt[1];
                data.push({
                    recipient,
                    timeStamp,
                    message,
                    txType,
                    amount
                });
            }
            console.log(data);
            // fetch account's balance
            nem.com.requests.account.data(endpoint, userWalletAddress).then(function(result) {
                const fmt = nem.utils.format.nemValue(result.account.balance);
                const accountBalance = fmt[0] + "." + fmt[1];
                dataTx.push({
                    accountBalance
                });
                // fetch user info by hash
                const searchEnabledEndpoint = nem.model.objects.create('endpoint')(nem.model.nodes.searchOnTestnet[0].uri, nem.model.nodes.defaultPort);
                nem.com.requests.transaction.byHash(searchEnabledEndpoint, hash).then(function(result) {
                    const userInfo = JSON.parse(nem.utils.format.hexMessage(result.transaction.message));
                    console.log(userInfo);
                    const hashData = result.transaction.message.payload; // to decrypt for users id send to dashboard

                   nem.com.requests.account.mosaics.owned(endpoint, userWalletAddress).then(function(result) {
                       let dataMosaic = [];
                        console.log(result.data[1]);
                        dataMosaic.push({
                            userMosaic: result.data[1].mosaicId
                        });
                        console.log(dataMosaic);
                        res.render('dashboard.pug', { data: data, dataTx: dataTx , userInfo: userInfo, dataMosaic: dataMosaic});
                    });
                });
            });
        });
    });
});

/*router.get('/account', (req, res) => {
    nem.com.requests.account.data(endpoint, process.env.TEST_ADDRESS).then(function(result) {
        console.log(result);
        res.json({
            acc_address: result.account.address,
            balance: result.account.balance,
            vested_balance: result.account.vestedBalance
        });
    }, function(err) {
         console.log(err);
    });
    console.log(nem.com.requests.account.data(endpoint, process.env.TEST_ADDRESS));
});*/

router.get('/account/loan', (req, res) => {
    res.render('loan.pug');
});

router.get('/account/dashboard', (req, res) => {
    res.render('dashboard.pug');
    /*let data = [];

    nem.com.requests.account.transactions.all(endpoint, process.env.TEST_ADDRESS).then(function(result) {
        console.log(result.data);

        for (let i = 0; i < result.data.length; i++) {
            const recipient = result.data[i].transaction.recipient; // transaction recipient
            const timeStamp = nem.utils.format.nemDate(result.data[i].transaction.timeStamp); // timestamp
            const message = nem.utils.format.hexMessage(result.data[i].transaction.message); // message
            const txType = nem.utils.format.txTypeToName(result.data[i].transaction.type); // transaction type
            const amount = nem.utils.format.nemValue(result.data[i].transaction.amount); // amount
            //const fmt = fmt[0] + "." + fmt[1];
            data.push({
                recipient,
                timeStamp,
                message,
                txType,
                amount
            });
        }
        res.render('dashboard.pug', {
            data
        });
        //console.log(sampleData);
    }, function(err) {
        console.log(err);
    });

    nem.com.requests.account.data(endpoint, process.env.TEST_ADDRESS).then(function(result) {
        return sampleData.push({acc_data: result});
    }, function(err) {
        console.log(err);
    });*/
});

//Todo: Invoice for payment due; 

//Todo: Apply loan confrmation depends the value of the collateral

router.post('/transfer', (req, res, next) => {
    User.findOne({wallet_address: req.body.my_address},function(err, result) {
        const pKey = result.get('privateKey');
        const pk = nem.utils.format.hexMessage(pKey);
        const walletPass = result.get('password');
        console.log(pKey)

        const transferCommon = nem.model.objects.create('common')(
            pk,
            walletPass
        );
        const transferTransaction = nem.model.objects.create(
            'transferTransaction')(
                req.body.recipient,
                req.body.amount,
                req.body.message
        );
    
        const transactionEntity = nem.model.transactions.prepare(
            'transferTransaction')(
                transferCommon,
                transferTransaction,
                nem.model.network.data.testnet.id
        );
    
        nem.model.transactions.send(transferCommon, transactionEntity, endpoint).then(function(result) {
            //console.log(res);
            //res.render('index.pug');
             res.json(result);
        }, function(err) {
            console.log(err);
        });
    });
});

/*  todo create nano wallet <- private key <- address <- send to main wallet <- saved hash, address, privatekey to database */
router.get('/register', (req, res) => {
    res.render('registration.pug');
});

router.post('/register', (req, res) => {
    let data = [];
    // Saved to database privatekey, address, transaction hash
    const rBytes = nem.crypto.nacl.randomBytes(32); // random bytes from PRNG
    const privateKey = nem.utils.convert.ua2hex(rBytes); // convert random bytes to hex
    const keyPair = nem.crypto.keyPair.create(privateKey);
    const publicKey = keyPair.publicKey.toString(); // to save to database
    const address = nem.model.address.toAddress(publicKey, nem.model.network.data.testnet.id);
    
    // Send to user
    const accountData = {
        name: req.body.name,
        middle_name: req.body.middle_name,
        lastname: req.body.lastname,
        contact: req.body.contact,
        gender: req.body.gender,
        email: req.body.email,
        address: req.body.address,
        valid_id: req.body.valid_id,
        valid_id_no: req.body.valid_id_no,
        wallet_address: address
    };

    const transferTransaction = nem.model.objects.create('transferTransaction')(
        address,
        0,
        JSON.stringify(accountData)
    );

    const transactionEntity = nem.model.transactions.prepare('transferTransaction')(
        common,
        transferTransaction,
        nem.model.network.data.testnet.id
    );

    nem.model.transactions.send(common, transactionEntity, endpoint).then(function(result) {
        data.push({
            walletAddress: address,
            publicKey: publicKey,
            privateKey: privateKey,
            txHash: result.transactionHash.data,
        });
        res.json(data);

        // save user, password, wallet address, publikey, privatekey, hash of the digital identity
        const user = new User({
            username: req.body.username,
            password: req.body.password,
            wallet_address: data[0].walletAddress,
            publicKey: data[0].publicKey,
            privateKey: data[0].privateKey,
            txHash: data[0].txHash
        });
        user.save(function(err) {
            if(err) console.log(err);
            console.log('user registration success');
        });

        User.find({}, function(err, result) {
            console.log(result);
        });
        //res.render('index.pug');
    }, function(err) {
        console.log(err);
    });
});

module.exports = router;

// Transfer assets


// my assets / ballance
// transfer money to remittance
// qr code to present to remittance center ADDRESS
// cash in 

// create an account
// - Fill up form, generate wallet address, send generated address from platform to newly created wallet
// - save address, privatekey, hash of the generated wallet transaction to the database