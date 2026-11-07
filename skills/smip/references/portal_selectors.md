# Hulumtimi dhe Funksionimi Teknik i Portalit SMIP (smip.al)

Ky dokument përmban analizën e plotë të ndërfaqes (UI), strukturës së të dhënave, selektorëve elastikë dhe logjikës së funksionimit të portalit **SMIP (Sistemi i Menaxhimit të Informacionit Parauniversitar)** për mësuesin.

---

## 1. Struktura e Ndërfaqes dhe Menutë Kryesore

### A. Menuja Anësore (Sidebar)
* **Faqja kryesore:** Pasqyra e njoftimeve dhe orarit të ditës (`/teacher` ose `/home`).
* **Regjistri:** Paneli kryesor ku kryhet menaxhimi ditor dhe periodik (`/teacher/registry?tab=daily-register` ose `?tab=trimester-register`).
* **Klasa kujdestare:** Seksioni i dedikuar për mësuesin kujdestar për të parë nxënësit, numrat e amzës, statusin, mungesat dhe vlerësimin e sjelljes (`/teacher/school-class?tab=school-class`).
* **Orari mësimor:** Orari zyrtar i ngarkuar nga drejtoria/sekretaria e shkollës (`/teacher/timetable`).
* **Plani vjetor:** Planet mësimore të ngarkuara nga mësuesi (`/teacher/documents`).
* **Portofoli digjital:** Detyrat dhe punimet e nxënësve.
* **Fund viti shkollor:** Mbyllja e regjistrit dhe gjenerimi i dëftesave.

### B. Header-i dhe Ndryshimi i Vitit Shkollor
* Në krye të faqes gjendet përzgjedhësi i **Vitit Shkollor** (`Viti shkollor`, p.sh. `2025-2026`, `2026-2027`).
* Ndërrimi i vitit shkollor ngarkon profilin historik të mësuesit, klasat përkatëse, nxënësit dhe notat e atij viti.
* Selektimi bëhet duke klikuar mbi kontrollin `[class*=-control]` të vitit shkollor dhe duke përzgjedhur opsionin nga menuja rënëse.

### C. Skedat (Tabs) brenda Regjistrit
1. **"Regjistri i lëndës" (`?tab=daily-register`):**
   * Përmban dy nën-skeda:
     * **"Temat" (`#topics`):** Lista e temave mësimore sipas datave, statistikat e orëve totale vs temave totale, dhe butoni i shtimit të temave (`#add-topic`).
     * **"Regjistri" (`#registry`):** Matrica me listën e nxënësve, orët e muajit, hedhjen e mungesave ("M") dhe vlerësimin e vazhduar ditor.
2. **"Regjistri i periudhës" (`?tab=trimester-register`):**
   * Matrica e vlerësimit periodik dhe ditor për të gjithë tremujorin (Periudha 1, 2, 3):
     * Notat ditore të vazhduara për çdo orë mësimi të zhvilluar.
     * **NVV** (Nota e Vlerësimit të Vazhduar)
     * **NT** (Nota e Testit / Provimit të periudhës)
     * **NLP** (Nota e Llogaritur e Periudhës)
3. **"Vlerësimet e periudhës dhe vjetore" (`?tab=student-grades`):**
   * Pasqyra përfundimtare për të treja periudhat dhe nota vjetore përfundimtare.

---

## 2. Sistemi Kaskadë i Filtrave (Klasa, Lënda, Periudha)

> [!WARNING]
> **Rregull Kritik:** Komponentët React Select gjenerojnë ID dinamike (p.sh. `#react-select-3-input`). **Mos përdorni kurrë ID numerike!** Përdorni etiketat semantike dhe strukturën hierarkike.

### Radhitja e Detyrueshme Kaskadë:
Dropdown-et në SMIP varen në mënyrë të drejtpërdrejtë nga njëri-tjetri:
1. **Klasa e bashkuar (Lëndë me zgjedhje):**
   * Etiketa `"Klasa e bashkuar"` ose `"Lëndë me zgjedhje"` $\rightarrow$ kontrolli bashkëngjitur $\rightarrow$ opsioni `"Jo"`.
2. **Klasa:**
   * Etiketa `"Klasa"` $\rightarrow$ klikoni `[class*=-control]` $\rightarrow$ zgjidhni opsionin (p.sh. `"6-A"`, `"7-A"`).
   * *Prisni 600-800ms* që të ngarkohet lista e lëndëve për atë klasë.
3. **Lënda:**
   * Etiketa `"Lënda"` $\rightarrow$ klikoni `[class*=-control]` $\rightarrow$ zgjidhni lëndën (p.sh. `"Edukim fizik..."` ose `"Gjuhë angleze..."`).
   * *Prisni 600-800ms* që të shfaqet fusha e Periudhës.
4. **Periudha (Kritike në `tab=trimester-register`):**
   * **KUJDES:** Fusha e Periudhës nuk ekziston në DOM derisa të jetë zgjedhur Lënda!
   * Kontrolli që përmban tekstin `"periudhën"` ose `"Periudha"` $\rightarrow$ klikoni $\rightarrow$ zgjidhni `"Periudha e parë"` (ose e dytë/tretë).
   * *Prisni 1000-1500ms* që tabela e plotë e nxënësve të shfaqet.

---

## 3. Menaxhimi i Notave në "Regjistrin e Periudhës" (`tab=trimester-register`)

### A. Struktura e Tabelës dhe Qelizave
* **Kokat e kolonave (`th`):**
  * Kolona 0: `"Nxënësi"` (Emri dhe mbiemri me numër rendor, p.sh. `1. Alteo Bruçi`).
  * Kolonat vijuese: Datat e orëve mësimore në formatin `DD/MM DITA` (p.sh. `16/10 E PREMTE`, `24/09 E ENJTE`).
* **Qelizat e të dhënave (`td`):**
  * Qeliza boshe përmban një buton me ikonë plus (`.jss-add-grade`, `#action-button`).
  * Qeliza me notë shfaq numrin e notës (p.sh. `8`) me mundësi modifikimi.

### B. Modali i Vendosjes së Notës (`.modal-panel`)
1. Klikoni butonin e shtimit në qelizën përkatëse:
   ```javascript
   const addBtn = cell.querySelector("button.jss-add-grade, #action-button");
   addBtn.click();
   ```
2. Zgjidhni llojin e vlerësimit:
   * Radio `"Vazhdueshem"`: `#evaluation-type-continuous`
   * Radio `"Provim"`: `#evaluation-type-exam`
3. Zgjidhni notën:
   * Butonat e notave kanë klasën `.jss-grade-button` me tekstin e notës (`4` deri `10`).
   * **Kritike:** Thirrni `gradeBtn.click()` me event vendas që React të regjistrojë ndryshimin në gjendjen e brendshme (state) dhe në listën dirty.
   * Modali mbyllet automatikisht sapo klikohet nota.

### C. Ruajtja e Notave me Butonin Bulk Save (`#bulk-save-grades`)
* Komponenti i regjistrit ruan një listë dirty me modifikimet e pa ruajtura.
* Butoni **"Ruaj Ndryshimet"** (`#bulk-save-grades`) renderohet në DOM **VETËM kur ka ndryshime** (`dirtyList.length > 0`).
* Pasi të keni vendosur të gjitha notat e klasës:
  ```javascript
  const saveBtn = document.getElementById("bulk-save-grades");
  if (saveBtn && !saveBtn.disabled) {
    saveBtn.click();
    await new Promise(r => setTimeout(r, 3000)); // Pritja e thirrjes API bulkSave
  }
  ```
* **Konfirmimi:** Zhdukja e butonit `#bulk-save-grades` nga faqja konfirmon se të gjitha notat u ruajtën me sukses në bazën e të dhënave të SMIP.

---

## 4. Mekanizmi i Shtimit të Temave dhe Lejet e Koordinatorit

### A. Kushti i Hapjes së Regjistrit nga Koordinatori (`can_change`)
* Nëse regjistri **nuk është hapur ende nga koordinatori**, portali kthen `can_change: false` dhe butoni `#add-topic` ("Shto temë") qëndron i fshehur.
* Agjenti përgatit temat lokalisht në skedarët `temat_<muaji>_<viti>.json` dhe `.md`, mban gati lidhjen me Chrome, dhe pret hapjen nga koordinatori për t'i hedhur menjëherë.

### B. Elementet e Shtimit kur Regjistri është Aktiv:
* **Nën-skeda:** Duhet të jetë e përzgjedhur nën-skeda **"Temat"** (`#topics`).
* **Butoni i shtimit:** `#add-topic` (Teksti: *"Shto temë"*).
* **Modali i regjistrimit (`#add-modal`):**
  * **Data:** Fusha `#date` (Data e orës mësimore sipas kalendarit).
  * **Titulli i temës:** Fusha `#name` ose fusha e tekstit të temës.
  * **Butoni i konfirmimit:** Butoni *"Konfirmo"* ose *"Shto"*.

---

## 5. Rregullat Pedagogjike dhe Ligjore të Vlerësimit

1. **Arsimi Fillor (Klasat 1-A, 2-A, 3-A):**
   * **NUK marrin nota numerike ditore (4-10)** sipas kurrikulës me kompetenca.
   * Vlerësimi bëhet vetëm me nivele arritjeje (Shkëlqyeshëm, Shumë mirë, Mirë, Mjaftueshëm) në fund të periudhës.
2. **Edukim Fizik:**
   * Notat vendosen **në rresht** (të gjithë nxënësit e klasës vlerësohen në një ditë të vetme mësimi për testim fizik/normë).
   * **Jo të gjitha klasat në një datë:** Çdo klasë duhet të vlerësohet në datën e saj unike të orarit.
3. **Gjuhë Angleze & Lëndët Shoqërore/Shkencore:**
   * Notat shpërndahen në data të rastësishme për secilin nxënës gjatë muajit.
4. **Përputhshmëria me Temën Mësimore:**
   * Çdo datë ku vendoset notë **DUHET** të ketë patjetër një temë mësimore të zhvilluar në regjistrin e SMIP.
5. **Historiku i Vitit të Kaluar:**
   * Kur hidhen nota fillestare, bazohemi te performanca e vitit të kaluar të të njëjtit nxënës në atë lëndë.
