# Hulumtimi dhe Funksionimi Teknik i Portalit SMIP (smip.al)

Ky dokument përmban analizën e plotë të ndërfaqes (UI), strukturës së të dhënave, selektorëve elastikë dhe logjikës së funksionimit të portalit **SMIP (Sistemi i Menaxhimit të Informacionit Parauniversitar)** për mësuesin.

---

## 1. Struktura e Ndërfaqes dhe Menutë Kryesore

### A. Menuja Anësore (Sidebar)
* **Faqja kryesore:** Pasqyra e njoftimeve dhe orarit të ditës (`/teacher` ose `/home`).
* **Regjistri:** Paneli kryesor ku kryhet menaxhimi ditor dhe periodik (`/teacher/registry?tab=daily-register`).
* **Klasa kujdestare:** Seksioni i dedikuar për mësuesin kujdestar për të parë nxënësit, numrat e amzës, statusin, mungesat dhe vlerësimin e sjelljes (`/teacher/school-class?tab=school-class`).
* **Orari mësimor:** Orari zyrtar i ngarkuar nga drejtoria/sekretaria e shkollës (`/teacher/timetable`).
* **Plani vjetor:** Planet mësimore të ngarkuara nga mësuesi (`/teacher/documents`).
* **Portofoli digjital:** Detyrat dhe punimet e nxënësve.
* **Fund viti shkollor:** Mbyllja e regjistrit dhe gjenerimi i dëftesave.

### B. Skedat (Tabs) brenda Regjistrit
1. **"Regjistri i lëndës" (`#tab-daily-register`):**
   * Përmban dy nën-skeda (subtabs):
     * **"Temat" (`#topics`):** Lista e temave mësimore sipas datave, statistikat e orëve totale vs temave totale, dhe butoni i shtimit të temave.
     * **"Regjistri" (`#registry`):** Matrica me listën e nxënësve, datat e orëve, hedhjen e mungesave ("M") dhe vlerësimin e vazhduar (notat ditore).
2. **"Regjistri i periudhës" (`#tab-trimester-register`):**
   * Llogaritja e notave periodike:
     * **NVV** (Nota e Vlerësimit të Vazhduar)
     * **NT** (Nota e Testit / Provimit të periudhës)
     * **NLP** (Nota e Llogaritur e Periudhës)
3. **"Vlerësimet e periudhës dhe vjetore" (`#tab-student-grades`):**
   * Pasqyra përfundimtare për të treja periudhat dhe nota vjetore përfundimtare.

---

## 2. Sistemi i Filtrave (Zgjedhja e Klasës dhe Lëndës)

> [!WARNING]
> **Rregull Kritik:** Komponentët React Select gjenerojnë ID dinamike (p.sh. `#react-select-3-input`, `#react-select-6-input`, etj.) të cilat rriten me çdo renderim të faqes ose ndërrim skede. **Mos përdorni kurrë ID fikse të react-select!** Gjejini kontrollet përmes etiketave (labels) përkatëse.

### Strategjia e Përzgjedhjes Rezistente ndaj Ndryshimeve (Semantic Selectors):
1. **Lëndë me zgjedhje:**
   * Gjeni etiketën me tekst `"Lëndë me zgjedhje"` $\rightarrow$ klikoni kontrollin bashkëngjitur $\rightarrow$ zgjidhni opsionin `"Jo"` ose `"Po"`.
2. **Klasa:**
   * Gjeni etiketën me tekst `"Klasa"` $\rightarrow$ klikoni `[class*=-control]` $\rightarrow$ zgjidhni nga opsionet e hapura `[class*=-option]` (p.sh. `"7-A"`, `"9-A"`).
3. **Lënda:**
   * Gjeni etiketën me tekst `"Lënda"` $\rightarrow$ klikoni kontrollin $\rightarrow$ zgjidhni lëndën përkatëse (p.sh. `"Edukim fizik, sporte dhe shëndeti (KURRIKULA BËRTHAMË)"`).
   * *Kujdes:* Dropdown-i i lëndës aktivizohet vetëm pasi është përzgjedhur klasa.
4. **Muaji:**
   * Fusha `#month-picker` (Komponent React Datepicker).
   * Formati: `MM/YYYY` (p.sh. `10/2026`). Në popover-in e hapur kalendarik, klikoni muajin përkatës (p.sh. `react-datepicker__month-9` për Tetorin) dhe mbylleni kalendarin me `Escape`.

---

## 3. Mekanizmi i Shtimit të Temave dhe Lejet e Koordinatorit

### A. Kushti i Hapjes së Regjistrit nga Koordinatori (`can_change`)
* Në sistemin SMIP, para se një mësues të mund të hedhë ose modifikojë temat ditore, **koordinatori ose administratori i shkollës** duhet të hapë regjistrin për modifikim dhe të plotësojë ngarkesën mësimore për atë periudhë.
* Nëse regjistri **nuk është hapur ende nga koordinatori**, portali kthen `can_change: false` dhe butoni `#add-topic` ("Shto temë") qëndron i fshehur.
* **Qasja e agjentit:** Agjenti përgatit dhe verifikon paraprakisht të gjitha temat në format të strukturuar (`.json` dhe `.md`), dhe pret hapjen e regjistrit nga koordinatori për t'i hedhur menjëherë.

### B. Elementet e Shtimit kur Regjistri është Aktiv:
* **Nën-skeda:** Duhet të jetë e përzgjedhur nën-skeda **"Temat"** (`#topics`).
* **Butoni i shtimit:** `#add-topic` (Teksti: *"Shto temë"*).
* **Modali i regjistrimit (`#add-modal`):**
  * **Data:** Fusha `#date` (Data e orës mësimore sipas kalendarit).
  * **Titulli i temës:** Fusha `#name` ose fusha e tekstit të temës.
  * **Butoni i konfirmimit:** Butoni *"Konfirmo"* ose *"Shto"*.
* **Veprimet shtesë mbi temat e regjistruara:**
  * Modifikimi: `#modify-topic` ose ikonat e lapsit në rreshtin përkatës.
  * Ngarkimi i materialeve: `#upload-document`.
  * Detyra shtëpie: `#assign-homework`.
  * Fshirja: `#delete-topic` / `#delete-topics`.

---

## 4. Klasat Kolektive (Të Bashkuara)

Në shkollat me numër të reduktuar nxënësish, përdoret regjimi i klasave kolektive (p.sh. **Klasa 7 & 9**):
* Në portalin SMIP, nxënësit janë të regjistruar në klasat e tyre përkatëse (5 nxënës te `7-A`, 2 nxënës te `9-A`).
* Mësuesi zhvillon të njëjtin orar të përbashkët (p.sh. të Mërkurave dhe të Premteve).
* Agjenti duhet të hedhë temat përkatëse duke përzgjedhur secilën klasë (`7-A` dhe `9-A`) sipas planit kurrikular të miratuar.

---

## 5. Rregulli i Vlerësimit dhe Notave

* **Zgjedhja e qelizës:** Klikohet te qeliza e nxënësit për datën përkatëse në skedën `"Regjistri"`.
* **Modali `#select-option-modal`:**
  * *"Vazhdueshem"* (`#evaluation-type-continuous`) – për notat e orës.
  * *"Provim"* (`#evaluation-type-exam`) – për testet.
  * Notat: `4` deri në `10`, ose `"M"` për mungesë.
* **Rregulli i 24 Orëve:** Mësuesi ka 24 orë kohë për ndryshime të lira; pas 24 orësh ndryshimi kërkon miratim zyrtar nga drejtoria.
* **Ruajtja:** Butoni i gjelbër `#bulk-save-grades` (*"Ruaj Ndryshimet"*).

---

## 6. Ruajtja e Lidhjes me Chrome (Sesioni Persistent CDP)

Për të mos kërkuar çdo herë konfirmim në Google Chrome:
* Shfrytëzohet skedari `DevToolsActivePort` në profilin lokal të përdoruesit.
* Mbështetet një lidhje e vazhdueshme (persistent worker daemon në sfond) që qëndron e lidhur pandërprerë përmes WebSocket-it të Chrome-it aktiv.
* Nuk shkëputet dhe nuk rilidhet lidhja pa nevojë, duke eliminuar shfaqjen e vazhdueshme të dialogut të Chrome-it.
