---
layout: post
title: "Piano and guitar stems just got better!"
category: announcement
header_class: post
intro: "We just made our high-quality piano and guitar stems better! Continue reading to find out how."
---

{{ page.intro }}

{% include admonitions.html
    type="tip"
    title="Want piano and guitar stems?"
    content="**Separate them right now for free [directly in your browser and see for yourself!](/)**"
%}

<img class="responsive-img-android" src="/assets/blog/post15/dalle_graphic.webp" alt="piano-guitar" width="50%"/>

<h2>Table of contents</h2>
* Table of contents
{:toc}

## Melody stems vs. piano and guitar stems

Music Demixer, our website, is one of the few stem separation websites and tools that can separate **piano** and **guitar** stems from a song.

This is a tricky task. Typical AI models for stem separation have four stems:
* **Vocals**
* **Drums**
* **Bass**
* **Other**, also known as **Accompaniment** - on our website, we call it **Melody**

Piano and guitar are contained inside the **Melody** stem, but generally, piano and guitar are popular and distinct instruments that have their own role in modern music.

In the case of stem separation where piano and guitar are offered separately from the melody stem, we also provide "other melody" which contains any other melodic instruments (like violin, flute, etc.) that are not piano or guitar.

## Why is it harder to separate piano and guitar?

Vocals, drums, bass, and melody can be considered to have distinct characteristics that make them easier to separate:

- **Drums** are primarily percussive, with sharp transients and noise-like elements that distinguish them from sustained instruments.
- **Bass** sits mostly in the lower frequency range, which makes it stand out from mid- and high-frequency instruments.
- **Vocals** have unique formant structures and a wide but identifiable pitch range, plus the human voice’s timbre is quite distinct compared to instruments.

When you get into separating **piano** and **guitar** from the rest of the melody, it’s more complex because:

1. **Overlap in Frequency Ranges**: Piano covers a very wide frequency range—from deep bass notes to bright treble—while guitars often sit in the midrange but can extend into higher frequencies, especially electric guitars with effects or acoustics with bright overtones.

2. **Similar Harmonic Content**: Both instruments can produce rich harmonics and chords. A single guitar strum or piano chord contains multiple frequencies that can overlap with each other and with other instruments in the mix.

3. **Varied Playing Styles**: Guitarists might use techniques like strumming, picking, palm muting, or distortion (for electric guitars), and pianists can use sustain pedals, staccato playing, or arpeggiation. These variations can blur the lines between instrument “signatures” and make it harder for AI models to distinguish them.

4. **Dynamic and Tonal Variability**: A piano can be played softly with a warm tone or loudly with a bright, percussive attack. Guitars have a wide array of tones—nylon strings, steel strings, electric with distortion, etc. The AI must adapt to these dynamic nuances.

Because of these factors, extracting piano and guitar separately requires more refined modeling and additional training data. Our latest improvements to Music Demixer’s AI models focus on these specific challenges, allowing our system to better pinpoint each instrument and cleanly isolate it for a more accurate, high-quality stem.

## What happens when you pick piano or guitar stems?

When you pick **piano** or **guitar** or **other melody** in Music Demixer, we use a special AI model that is trained to separate piano, guitar, and other melody from the mixed song. If you also requested the **melody** stem, we combine these melodic instruments into a single melody stem to also provide you with the full melody.

<img src="/assets/blog/post15/stemsettings.webp" alt="music-demixer-stem-settings" width="25%"/>

## How did we improve piano and guitar stems?

In short, the higher quality levels on Music Demixer use what is known as <b>AI ensemble models.</b> This is a technical term for "mixing different AI models together to get the best results."

For example, since we have high-quality drum and bass separation, using those to remove drum and bass before separating piano and guitar <span class="blog-highlight">will lead to a quality boost for piano and guitar.</span>

Because we improved the speed of our AI model and ensemble model execution, we were able to create a new quality level for piano and guitar stems. This new quality level is available to all users, including free users.

## How did we make the AI models faster?

For a single execution of the AI model, earlier this year we made it run **4x faster** at a minimum, which is an astonishing improvement. We did this by leveraging cutting-edge AI acceleration technologies like [ONNXRuntime](https://onnxruntime.ai/).

For ensemble models where we run AI models multiple times, we made a change recently that intelligently chooses which parts of the ensemble run for any combination of user input stems.

This also means that since we have better control over the number of AI model executions per song demix, we can offer more quality levels within this "execution budget."

## Conclusion

We are constantly working to improve the quality of our stems and the speed of our website, and we are excited to bring you these improvements.

{% include admonitions.html
    type="tip"
    title="Check out our competitor comparison pages!"
    content="**[We recently compared Music Demixer to Spleeter](/vs-spleeter) to let our users make the best choice in stem separation tools!**"
%}
