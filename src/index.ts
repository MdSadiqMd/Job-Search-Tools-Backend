import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { parseString } from 'xml2js';

import { logger, serverConfig } from './config';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/api/cover-letter', async (req: Request, res: Response) => {
    try {
        const { file, fileType } = req.body;
        console.log(req.body);
        if (!file || !fileType) {
            return res.status(400).json({ message: 'No file or file type provided' });
        }
        const buffer = Buffer.from(file, 'base64');
        let text = '';

        if (fileType === 'application/pdf') {
            text = await parsePdf(buffer);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            text = await parseDocx(buffer) as string;
        } else if (fileType === 'text/plain') {
            text = buffer.toString('utf-8');
        } else {
            return res.status(400).json({ message: 'Unsupported file type' });
        }
        console.log("text", text);
        logger.info(`Parsed Resume: ${text}`)
        res.json({ text });
    } catch (error) {
        logger.error(`Error in parsing resume: ${error}`)
        res.status(500).json({ message: 'Error processing file' });
    }
});

const parsePdf = async (buffer: Buffer): Promise<string> => {
    const data = await pdfParse(buffer);
    return data.text;
};

const parseDocx = async (buffer: Buffer): Promise<string> => {
    const tempFilePath = path.join(__dirname, 'temp.docx');
    fs.writeFileSync(tempFilePath, buffer);

    return new Promise((resolve, reject) => {
        fs.readFile(tempFilePath, 'utf8', (err: NodeJS.ErrnoException | null, data: string) => {
            if (err) return reject(err);

            parseString(data, (err: any, result: any) => {
                if (err) return reject(err);

                const text = extractTextFromDocx(result);
                resolve(text);
            });
        });
    });
};

const extractTextFromDocx = (docx: any): string => {
    return '';
};

app.listen(serverConfig.PORT, () => {
    console.log(`Server running on Port: ${serverConfig.PORT}`);
});