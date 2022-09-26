const router = require('express').Router();

const axios = require('axios');
const fs = require('fs'); 
const speech = require('microsoft-cognitiveservices-speech-sdk');
const audioconcat = require('audioconcat');
const appConfig = require('../config');
const globby = require("glob");

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

function zeroFill(intNumber) {
  strNumber = "";
  if (intNumber < 10) {
    strNumber = "0" + intNumber.toString();
  }
  else {
    strNumber = intNumber.toString();
  }
  return (strNumber);
}

router.post('/grabber', function (req, res) {
  const strLanguage = req.body.strLanguage;
  axios.get("https://" + strLanguage + ".wikipedia.org/w/api.php?action=query&format=json&titles=" + req.body.strArticle + "&prop=extracts&explaintext")
    .then((objResponse) => {
      if (objResponse.status === 200) {
        const objHTML = objResponse.data;
        const objElement = objHTML.query.pages[Object.keys(objHTML.query.pages)[0]];
        const strTitle = objElement.title;
        
        let strExtract = objElement.extract;
        strExtract = strExtract.replace(/(\[.*?\])/g, '');

        res.json({ strTitle: strTitle, strExtract : strExtract });
      }
    },
    (error) => console.log(err));
});

router.post('/formatter', function (req, res) {
  
  const strLanguage = req.body.strLanguage;  
  const intSectionLength = 4000;

  let strText = req.body.strText;

  let arrSections = [];
  let strSection = "";

  let strVoiceName = "";
  let strVoiceStyle = "";
  let strProsodyRate = "";
  let strProsodyPitch = "";
  let strXMLLanguage = "";

  if (strLanguage == "de") {
    strVoiceName = "de-DE-KatjaNeural";
    strVoiceStyle = "";
    strProsodyRate = "0%";
    strProsodyPitch = "-1%";
  }
  else {
    strVoiceName = "en-US-AriaNeural";
    strVoiceStyle = "newscast-casual";
    strProsodyRate = "-1%";
    strProsodyPitch = "-1%";
  }

  const strOutputHeader = '<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="' + strVoiceName +'"><mstts:express-as style="' + strVoiceStyle + '"><prosody rate="' + strProsodyRate + '" pitch="' + strProsodyPitch + '">';
  const strOutputFooter = '</prosody></mstts:express-as></voice></speak>';

  /*
    Intelligente Trennung
  */
  for (let intIndex = 0; intIndex < Math.ceil(strText.length / intSectionLength); intIndex++) {
    strSection = strText.substr(intIndex * intSectionLength, intSectionLength);
    arrSections.push(strSection);
  }

  arrSections[0]  = req.body.strArticle + '<break time="1s"/>' + arrSections[0];

  let arrBlocks = [];
  for (let intIndex = 0; intIndex < arrSections.length; intIndex++) {
    strText = arrSections[intIndex];
    strText = strText.replace(/===/g, '<break time="1s"/>'); 
    strText = strText.replace(/==/g, '<break time="1s"/>'); 
    strText = strText.replace(/\n/g, ' ');           

    strText = strText.replace(/\s{2,3}/g, ' ');    
    strText = strText.replace(/([a-z0-9]{1})\.([A-Z0-9]{1})/g, '$1. $2');

    if (strLanguage == "de") {
      strText = strText.replace('(*', '(geboren am');
      strText = strText.replace('&', 'und');
    }
    else {
      strText = strText.replace('&', 'and');
    }

    strText = strOutputHeader + strText + strOutputFooter;
    arrBlocks.push(strText); 
  }

  res.json(arrBlocks);
});

router.post('/converter', function (req, res) {
  const strText = req.body.strText;
  const strArticle = req.body.strArticle;
  const intIndex = req.body.intIndex;  

  const speechConfig = speech.SpeechConfig.fromSubscription(process.env.MS_SPEECH_KEY, process.env.MS_SPEECH_REGION);
  //speechConfig.speechSynthesisOutputFormat = speech.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;
  const audioConfig = speech.AudioConfig.fromAudioFileOutput(strArticle + "_" + zeroFill(intIndex) + ".wav");
  const synthesizer = new speech.SpeechSynthesizer(speechConfig, audioConfig);

  console.log("+++++++++++++++++++++++++++++++++++++++++");
  console.log(strText);
  console.log(strArticle + "_" + intIndex);

  synthesizer.speakSsmlAsync(
    strText,
    result => {
      if (result) {
        console.log("Result:");
        console.log(result);
        synthesizer.close();
        fs.createReadStream(strArticle + "_" + zeroFill(intIndex) + ".wav");
        res.sendStatus(200);
      }
    },
    error => {
      console.log("Error:");      
      console.log(error);
      synthesizer.close();
      res.sendStatus(500);
  });
});

router.post('/merger', function (req, res) {
  const strArticle = req.body.strArticle;
  const intCount = req.body.intCount;  
  
  let arrFiles = [];

  globby(strArticle + "*.wav", function (objError, arrFiles) {
    console.log(arrFiles);
    audioconcat(arrFiles)
    .concat(strArticle + '_all.wav')
    .on('end', function (objOutput) {
        console.log(objOutput);
        res.sendStatus(200);
    });
  });
});

module.exports = router;