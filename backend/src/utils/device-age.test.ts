import { deviceAge } from './device-age';

const TODAY = new Date('2026-10-05T12:00:00Z');

describe('deviceAge', () => {
  it.each([
    ['Philips HS1', 'A18A-06336', 2018, 'replace'],
    ['Philips FRx', 'B17C-00516', 2017, 'replace'],
    ['Philips FRx', 'B15L-00123', 2015, 'replaceUrgently'],
    ['Zoll AED Plus', 'X14K718292', 2014, 'replaceUrgently'],
    ['Zoll AED 3', 'AX19D028376', 2019, 'replace'],
    ['Zoll AED 3', 'AX21B000111', 2021, 'checkInvoice'],
    ['Philips HS1', 'A23F-00001', 2023, 'current'],
  ])('reads %s serial %s as made in %i (%s)', (model, serial, year, band) => {
    expect(deviceAge(model, serial, null, TODAY)).toMatchObject({ year, band });
  });

  it('reads a Powerheart from the date printed on its label', () => {
    expect(deviceAge('Zoll Powerheart G3', '4416059', '2012-11', TODAY)).toMatchObject({ year: 2012, band: 'replaceUrgently' });
    expect(deviceAge('Zoll Powerheart G5', 'D00000024001', '2016-05-16', TODAY)).toMatchObject({ year: 2016, band: 'replace' });
  });

  it('says nothing rather than guess', () => {
    expect(deviceAge('Zoll Powerheart G3', '4416059', null, TODAY)).toBeNull(); // no date in this serial
    expect(deviceAge('Philips HS1', 'A1BA-06336', null, TODAY)).toBeNull(); // misread digit
    expect(deviceAge('Zoll AED Plus', 'X14Z718292', null, TODAY)).toBeNull(); // no such month
    expect(deviceAge('Philips HS1', 'A39A-00001', null, TODAY)).toBeNull(); // a year still to come
  });
});
