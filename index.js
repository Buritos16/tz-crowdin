const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const crowdin = require('@crowdin/crowdin-api-client');
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcrypt')

let sql;

const db = new sqlite3.Database('./users.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message)
})

/* CREATING TABLE (USE ONLY ONCE) */
/*sql = `CREATE TABLE users(id INTEGER PRIMARY KEY, projectId, tokenCrowdin)`;
db.run(sql)*/

/* Only to read data from DB */
/*sql = `SELECT * FROM users`
db.all(sql, [], (err, rows) => {
    if (err) return console.error(err.message)
    rows.forEach(row => console.log(row))
})*/


const app = express()
app.use(express.json())
app.use(cors())

const PORT = process.env.PORT || 9000;

/* Endpoints to server the HTML */
app.get('/', (req, res) => {
    res.sendFile('pages/home.html', {root: __dirname})
})

app.get('/connect', (req, res) => {
    res.sendFile('pages/connect.html', {root: __dirname})
})

/* Endpoints for API */
app.post('/connect', async (req, res) => {
    try {

        /* ENCRYPTED CROWDIN TOKEN */
        const salt = await bcrypt.genSalt(10);
        const tokenHash = await bcrypt.hash(req.body.tokenCrowdin, salt);

        /* INSERTING DATA INTO DB */
        sql = `INSERT INTO users(projectId, tokenCrowdin) VALUES (?,?)`
        db.run(sql, [req.body.projectId, tokenHash], (err) => {
            if (err) return console.error(err.message)
        })

        /* CREATING TOKEN FOR CLIENT LOCALSTORAGE */
        const token = jwt.sign({
                projectId: req.body.projectId,
                tokenCrowdin: req.body.tokenCrowdin,
            }, 'hello12345',
            {
                expiresIn: '2h',
            });

        res.status(200).json({
            message: 'success',
            jwtToken: token
        })
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: 'Error while connecting',
        });
    }
})

app.get('/home', async (req, res) => {
    const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
    if (token) {
        try {
            const decodedToken = jwt.verify(token, 'hello12345');
            const {
                sourceFilesApi,
            } = new crowdin.default({
                token: decodedToken.tokenCrowdin
            });

            const projects = await sourceFilesApi.listProjectFiles(decodedToken.projectId);
            const filesData = JSON.stringify(projects)

            res.status(200).json({
                message: 'success',
                data: filesData
            })

        } catch (err) {
            return res.status(403).json({
                message: 'No access'
            });
        }
    } else {
        return res.status(403).json({
            message: 'No access'
        });
    }
})


app.post('/download', async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
        const decodedToken = jwt.verify(token, 'hello12345');

        let fileId = Number(req.body[0].id)
        /* Changing file ID */
        fileId = 9

        const {
            translationsApi
        } = new crowdin.default({
            token: decodedToken.tokenCrowdin
        });

        const fileData = await translationsApi.buildProjectFileTranslation(decodedToken.projectId, fileId, {"targetLanguageId": "en"});
        const fileUrl = fileData.data.url

        res.status(200).json({
            message: 'success',
            url: fileUrl
        })
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: 'Error while downloading',
        });
    }
})

app.post('/upload', async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
        const decodedToken = jwt.verify(token, 'hello12345');
        const {
            uploadStorageApi,
            sourceFilesApi
        } = new crowdin.default({
            token: decodedToken.tokenCrowdin
        });

        const storage = await uploadStorageApi.addStorage(req.body.fileName, req.body.binary);
        const file = await sourceFilesApi.createFile(decodedToken.projectId, {
            "storageId": storage.data.id,
            "name": req.body.fileName,
            "directoryId": req.body.directoryId
        })

        if (file.data) {
            res.status(200).json({
                message: 'success'
            })
        } else {
            res.status(400).json({
                message: 'Error while uploading'
            })
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: 'Error while uploading',
        });
    }
})


app.listen(PORT, () => {
    console.log(`Server port: ${PORT}`)
})