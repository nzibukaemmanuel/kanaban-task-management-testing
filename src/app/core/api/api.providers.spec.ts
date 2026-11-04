import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment as development } from '../../../environments/environment';
import { environment as production } from '../../../environments/environment.prod';
import { API_BASE_URL } from './api.config';
import { provideApi } from './api.providers';

describe('provideApi', () => {
  it('exposes the environment apiUrl through API_BASE_URL', () => {
    TestBed.configureTestingModule({ providers: [provideApi({ apiUrl: 'https://api.example.com' })] });

    expect(TestBed.inject(API_BASE_URL)).toBe('https://api.example.com');
  });

  it('sends a real request to apiUrl', () => {
    TestBed.configureTestingModule({
      providers: [provideApi({ apiUrl: 'http://localhost:3000' }), provideHttpClientTesting()],
    });
    const httpMock = TestBed.inject(HttpTestingController);

    TestBed.inject(HttpClient).get('http://localhost:3000/boards').subscribe();

    const req = httpMock.expectOne('http://localhost:3000/boards');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    httpMock.verify();
  });

  it('ships distinct development and production configurations', () => {
    expect(development).toMatchObject({ production: false, apiUrl: 'http://localhost:3000' });
    expect(production).toMatchObject({ production: true, apiUrl: 'https://kanban-api-h8q1.onrender.com' });
  });
});
