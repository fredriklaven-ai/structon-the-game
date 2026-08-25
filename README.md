# Structon The Game 🏗️

> **Bygg höga byggnader, bemästra bärverksfysik och stå emot stormar, vindlaster, jordbävningar och jordskred!**

Spela spelet direkt i webbläsaren eller på mobilen:  
👉 **[Spela Structon The Game Online](https://fredriklaven-ai.github.io/structon-the-game/)**

---

## 🎮 Om spelet

I **Structon The Game** agerar du chefsingenjör och bygger allt från små villor till storslagna skyskrapor, kontorstorn och flygplatsterminaler. Varje konstruktion utsätts för realistiska fysikaliska krafter och naturkatastrofer.

### 🌟 Funktioner
- **Realistisk 2D FEM / Bärverksmotor**: Beräknar spänningar (drag, tryck, knäckning) i realtid med färgkodad spännings-heatmap.
- **Flera Byggnadsmaterial**:
  - 🧱 **Platsgjuten betong**: Hög tryckhållfasthet för grundplattor och källare.
  - 🏢 **Armerad betong**: Tål både högt tryck och dragkrafter för pelare och bjälklag.
  - 🏗️ **Konstruktionsstål**: Extremt starkt och styvt för höga skyskrapor och långa spännvidder.
  - 🪵 **Trä / Limträ**: Lätt, prisvärt och flexibelt för villor och takstolar.
  - 🧱 **Murat tegel**: Klassiskt med god tryckhållfasthet.
  - 📐 **Strävor & Kryssförband**: Diagonala stag mot vind- och jordbävningssvaj.
  - 📍 **Betongpålar**: Djupgrundläggning som slås genom lera ner till fast berg för att hindra skred.
- **Naturkrafter & Miljölaster**:
  - 🌪️ Höjdberoende vindprofil och stormbyar.
  - 🌧️ Ösregn, vattenansamling och försvagning av lerjord.
  - 🌋 Jordbävningar (Richter-skala) med seismiska vågor.
  - ⚠️ Jordskred vid kraftigt regn på känslig lerjord.
- **6 Kampanjnivåer + Sandlådeläge**:
  1. *Villa Solbacken* (2-plansvilla i trä och betong)
  2. *Kvarteret Teglet* (4-vånings bostadshus)
  3. *Nordic Tech Tower* (10-våningars kontorstorn)
  4. *Skyline Spire* (68m skyskrapa mot orkan)
  5. *Grand Skyport Terminal* (36m spännvidd på skredkänslig mark)
  6. *Burj Structon* (105m megaskyskrapa)
  7. *Sandlådeläge* (Fri byggnad med anpassningsbara katastrofsliders)
- **Mobil Touch-First UI & Ljud**:
  - Nyp-för-zoom, panorering och magnetisk nod-snäppning.
  - 100% syntetiserat proceduriellt Web Audio-ljud.

---

## 🛠️ Lokal utveckling & körning

Kör projektet lokalt med Node.js:

```bash
git clone https://github.com/fredriklaven-ai/structon-the-game.git
cd structon-the-game
node server.js
```

Öppna sedan `http://localhost:3000` i webbläsaren!
