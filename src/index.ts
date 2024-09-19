import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { parseString } from 'xml2js';
import OpenAI from 'openai';
const { GoogleGenerativeAI } = require("@google/generative-ai");

import { logger, serverConfig } from './config';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const client = new OpenAI({
    apiKey: serverConfig.OPEN_API_KEY,
});

async function coverLetterGenerationOPENAI(parsedResume: string, jobDescription: string) {
    const chatCompletion = await client.chat.completions.create({
        messages: [{ role: 'user', content: `Generate a cover letter for this resume text: \n${parsedResume} for Job Description ${jobDescription}` }],
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        temperature: 0.6,
    });
    return chatCompletion;
}

async function coverLetterGenerationGEMINI(parsedResume: string, jobDescription: string) {
    try {
        const genAI = new GoogleGenerativeAI(serverConfig.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: serverConfig.GEMINI_MODEL });
        const prompt = `Generate a brief and professional cover letter for the job described below.
                        Use the resume content provided for personal details. Keep it short.
                        Job Description: ${jobDescription}
                        Resume Content: ${parsedResume}
                        `;
        const result = await model.generateContent(prompt);
        return result;
    } catch (error: any) {
        logger.error(`Error in generating cover Letter: ${error}`);
    }
}

app.post('/api/cover-letter', async (req: Request, res: Response) => {
    try {
        const { parsedResume, jobDescription } = req.body;
        /* console.log(req.body); */
        /* const coverLetter = await coverLetterGenerationOPENAI(text); */ // OPEN AI
        const coverLetter = await coverLetterGenerationGEMINI(parsedResume, jobDescription); // GEMINI
        res.json({ coverLetter });
    } catch (error) {
        logger.error(`Error in generating cover letter: ${error}`);
        res.status(500).json({ message: 'Error generating cover letter' });
    }
});

app.post('/api/parse-resume', async (req: Request, res: Response) => {
    try {
        const { file, fileType } = req.body;
        if (!file || !fileType) {
            return res.status(400).json({ message: 'No file or file type provided' });
        }
        const buffer = Buffer.from(file, 'base64');
        let parsedResumeContents = '';

        if (fileType === 'application/pdf') {
            parsedResumeContents = await parsePdf(buffer);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            parsedResumeContents = await parseDocx(buffer) as string;
        } else if (fileType === 'text/plain') {
            parsedResumeContents = buffer.toString('utf-8');
        } else {
            return res.status(400).json({ message: 'Unsupported file type' });
        }
        logger.info(`Parsed Resume: ${parsedResumeContents}`);
        res.json({ parsedResumeContents });
    } catch (error) {
        logger.error(`Error in parsing resume: ${error}`);
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