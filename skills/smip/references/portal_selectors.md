# Hulumtimi dhe Funksionimi Teknik i Portalit SMIP (smip.al)

Ky dokument përmban analizën e plotë të ndërfaqes (UI), strukturës së të dhënave, selektorëve dhe logjikës së funksionimit të portalit **SMIP (Sistemi i Menaxhimit të Informacionit Parauniversitar)** për mësuesin.

---

## 1. Struktura e Ndërfaqes dhe Menutë Kryesore

### A. Menuja Anësore (Sidebar)
* **Faqja kryesore:** Pasqyra e njoftimeve dhe orarit të ditës.
* **Regjistri:** Paneli kryesor ku kryhet menaxhimi ditor dhe periodik.
* **Klasa kujdestare:** Seksioni i dedikuar për mësuesin kujdestar (Klasa 6 & 8) për miratimin e mungesave dhe vlerësimin e sjelljes.
* **Orari mësimor:** Orari zyrtar i ngarkuar nga drejtoria/sekretaria e shkollës.
* **Plani vjetor:** Planet mësimore të ngarkuara.
* **Portofoli digjital:** Detyrat dhe punimet e nxënësve.
* **Fund viti shkollor:** Mbyllja e regjistrit dhe gjenerimi i dëftesave.

### B. Skedat (Tabs) brenda Regjistrit
1. **"Regjistri i lëndës" (Regjistri Ditor):**
   * Pamja tabelare mujore sipas datave.
   * Këtu hidhen: Temat ditore, Mungesat ("M") dhe Vlerësimi i Vazhduar (notat ditore).
2. **"Regjistri i periudhës":**
   * Llogaritja e notave periodike:
     * **NVV** (Nota e Vlerësimit të Vazhduar)
     * **NT** (Nota e Testit / Provimit të periudhës)
     * **NLP** (Nota e Llogaritur e Periudhës)
3. **"Vlerësimet e periudhës dhe vjetore":**
   * Pasqyra përfundimtare për të treja periudhat dhe nota vjetore përfundimtare.

---

## 2. Sistemi i Filtrave (Zgjedhja e Klasës dhe Lëndës)

Për të hapur regjistrin e një klase, përdoret formulari me komponentët React Select:
* **Lëndë me zgjedhje:** Dropdown me vlerat "Jo" / "Po" (Selector: `#react-select-5-input`).
* **Klasa:** Dropdown me listën e klasave (Selector: `#react-select-6-input`).
* **Lënda:** Dropdown me lëndët përkatëse (Selector: `#react-select-7-input`).
  > *Vërejtje:* Lënda shfaqet aktive vetëm pasi zgjidhet klasa dhe pasi sekretaria e shkollës ka bërë caktimin mësues-lëndë në sistem.
* **Muaji:** Zgjedhësi kalendarik me formatin `MM/YYYY` (Selector: `#month-picker`, p.sh. `09/2026`).

---

## 3. Mekanizmi i Shtimit të Temave Ditore

* **Butoni i hapjes:** `#add-topic` (Etiketa: *"Shto temë"*).
* **Modali i regjistrimit (`#add-modal`):**
  * **Data:** Fusha `#date` (Komponent DatePicker me kufizim `minDate` / `maxDate`).
  * **Titulli i temës:** Fusha `#name` (Teksti i temës mësimore).
  * **Butoni:** Konfirmo / Shto.
* **Veprimet shtesë mbi temën e regjistruar:**
  * Modifikimi i temës: `#modify-topic`
  * Ngarkimi i materialeve/dokumenteve mësimore (PDF/Word): `#upload-document`
  * Caktimi i detyrave të shtëpisë bashkë me afatin e dorëzimit: `#assign-homework`
  * Fshirja e temës: `#delete-topic`

---

## 4. Mekanizmi i Notave dhe Mungesave

* **Pamja e tabelës:**
  * Rreshti: Nxënësit e klasës (kolona e majtë e ngrirë me Emër / Mbiemër).
  * Kolonat: Datat e orëve mësimore për muajin e zgjedhur.
* **Vendosja e notës / mungesës:**
  * Klikohet në qelizën e nxënësit për datën specifike $\rightarrow$ Hapet modali `#select-option-modal`.
  * **Tipi i vlerësimit:**
    * Radio button *"Vazhdueshem"* (`#evaluation-type-continuous`) – për notat e zakonshme të orës.
    * Radio button *"Provim"* (`#evaluation-type-exam`) – për testet/provimet periodike.
  * **Zgjedhja e notës:** Butonat me vlerat `4, 5, 6, 7, 8, 9, 10` ose butoni `"M"` për mungesë.
* **Rregulli Kritik i 24 Orëve:**
  * Mësuesi mund të modifikojë lirisht notën ose mungesën brenda **24 orëve** nga hedhja e saj.
  * Pas 24 orësh, fusha bllokohet dhe ndryshimi kërkon arsyetim me shkrim (`#reason`) dhe miratim administrativ nga drejtoria e shkollës.
* **Ruajtja masive:**
  * Të gjitha ndryshimet ruhen duke klikuar butonin e gjelbër në fund: `#bulk-save-grades` (*"Ruaj Ndryshimet"*).
