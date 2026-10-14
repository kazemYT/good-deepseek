/** A per-generation PptxGenJS subclass. No shared prototype mutations. */
export function createPresentationClass(Base, loadImage, onWrite) {
  return class IllustratedPresentation extends Base {
    constructor(...args) {
      super(...args);
      this.pendingImages = [];
      this.imageCache = new Map();
    }
    addSlide(...args) {
      const slide = super.addSlide(...args);
      const addImage = slide.addImage.bind(slide);
      slide.addImage = (options) => {
        if (!options?.path || !/^https?:\/\//i.test(options.path)) return addImage(options);
        const { path, ...rest } = options;
        if (!this.imageCache.has(path)) this.imageCache.set(path, loadImage(path));
        const pending = this.imageCache.get(path).then(image => addImage({ ...rest, data: image.data }));
        // Attach a rejection handler immediately; writeFile still propagates errors.
        pending.catch(() => {});
        this.pendingImages.push(pending);
        return slide;
      };
      return slide;
    }
    async writeFile() {
      await Promise.all(this.pendingImages);
      const base64 = await this.write({ outputType: 'base64' });
      onWrite(base64);
      return base64;
    }
  };
}
