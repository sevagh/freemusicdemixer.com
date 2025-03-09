---
layout: post
title: "Printable sheet music directly on our website"
category: announcements
header_class: post
intro: "You can now display, print, and save sheet music directly in our website, generated automatically from your music files!"
---

{{ page.intro }}

<h2>Table of contents</h2>
* Table of contents
{:toc}

In our marketing materials for the first release of our MIDI conversion feature, sheet music was heavily featured. However, this was rendered by a different software that we used to load the MIDI file.

Although many of you may have workflows that include powerful tools like MuseScore or other sophisticated MIDI software that generate scores and sheet music, we realized that many users would prefer a simpler, more integrated solution.

## How to use the new feature

Just like with the MIDI feature, just check the box for "MIDI Music transcription", which you can do with or without stem separation:

<img src="/assets/blog/post17/mdx-settings.webp" alt="mdx-settings" width="50%"/>

Just like with the MIDI conversion, we generate it for:
* Direct user input audio files (it is strongly suggested to upload single harmonic instruments)
* With stem separation, we will generate it for the following stems: vocals, bass, melody, other melody, piano, and guitar

## New output

In the output page, you can download the ".wav" files for the stems and the ".mid" files for the MIDI outputs as usual.

Then, there is a new button to display the sheet music (using the excellent [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) library):

<img src="/assets/blog/post17/mdx-widget.webp" alt="mdx-sheet-music-button" width="50%"/>

This leads you to the next window where you can open the sheet music for each stem (or for your uploaded track) in a new tab:

<img src="/assets/blog/post17/mdx-output-page.webp" alt="mdx-output-links" width="50%"/>

## Printing and saving the sheet music

{% include admonitions.html
    type="tip"
    title="What is MusicXML?"
    content="MusicXML is a universal format for sheet music and scoresthat can be read by most notation software."
%}

Our sheet music feature is powered by generating MusicXML file from the MIDI files for each of the stems.

You can save the ".musicxml" file for each stem or the MIDI output, or print the sheet music directly from your browser:

<img src="/assets/blog/post17/printable-sheet-music.webp" alt="mdx-sheet-music" width="75%"/>

If you import the score into MuseScore or another more advanced notation software, you can make further edits and refinements to the sheet music. You may get an error about inconsistencies in the score, like this in MuseScore:

<img src="/assets/blog/post17/musescore-error.webp" alt="musescore-error" width="50%"/>

This is normal and expected: we strive to deliver good results, but automatic transcription is a challenging task to achieve with software tools.

Hopefully, the scores can help you get started with your music projects, whether you are a student, teacher, composer, or performer.
