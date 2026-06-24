export class BasePage {
    constructor() {
        this.container = document.createElement('div');
        this.pageData = {};
    }
    
    render() {
        return this.container;
    }
    
    mounted() {
        // Lifecycle hook - override in subclasses
    }
    
    beforeUnmount() {
        // Cleanup hook - override in subclasses
    }
    
    setTitle(title) {
        document.title = `${title} - EXAM PONCOL`;
    }
}
