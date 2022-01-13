import sinon from 'sinon';

export class ContextMock {
  accessors: any;
  errors: any;
  constructors: any;
  log: any;
  errorsManager: any;
  config: any;
  kerror: any;
  secrets: any;


  constructor() {
    this.log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };

  }
}